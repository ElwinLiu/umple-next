package handlers

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/umple/umpleonline/backend/internal/compiler"
	"github.com/umple/umpleonline/backend/internal/model"
)

// ---------------------------------------------------------------------------
// Model validator — simulates what the Umple compiler checks.
// ---------------------------------------------------------------------------

// definedClasses extracts all class names from "class Name" declarations in
// the user-code section (before the model delimiter).
func definedClasses(model string) map[string]bool {
	if idx := strings.Index(model, modelDelimiter); idx >= 0 {
		model = model[:idx]
	}
	re := regexp.MustCompile(`(?m)^\s*class\s+(\w+)`)
	out := map[string]bool{}
	for _, m := range re.FindAllStringSubmatch(model, -1) {
		out[m[1]] = true
	}
	return out
}

// referencedClasses extracts class names that appear in association or isA
// contexts inside the user-code section.  It returns names that are NOT
// class/interface keywords — i.e. the "other end" identifiers.
func referencedClasses(model string) map[string]bool {
	if idx := strings.Index(model, modelDelimiter); idx >= 0 {
		model = model[:idx]
	}
	refs := map[string]bool{}

	// Inline / standalone association lines (contain --, -> or <@>).
	assocLine := regexp.MustCompile(`(?m)^[^\n]*(--|->|<@>)[^\n]*;`)
	classInAssoc := regexp.MustCompile(`\b([A-Z]\w*)\b`)
	for _, line := range assocLine.FindAllString(model, -1) {
		for _, m := range classInAssoc.FindAllStringSubmatch(line, -1) {
			refs[m[1]] = true
		}
	}

	// isA lines — both standalone (start of line) and inline (mid-line in
	// single-line class definitions like "class Foo { isA Bar; }").
	isaLine := regexp.MustCompile(`isA\s+([^;]+);`)
	for _, m := range isaLine.FindAllStringSubmatch(model, -1) {
		for _, part := range strings.Split(m[1], ",") {
			name := strings.TrimSpace(part)
			if name != "" {
				refs[name] = true
			}
		}
	}

	// associationClass endpoint lines (e.g. "* Facility;" inside an
	// associationClass block).
	acBlock := regexp.MustCompile(`(?ms)^\s*associationClass\s+\w+\s*\{((?:[^{}]*|\{[^{}]*\})*)?\}`)
	acEndpoint := regexp.MustCompile(`(?m)^\s*[\d*]+(?:\.\.[\d*]+)?\s+([A-Z]\w*)\s*;`)
	for _, m := range acBlock.FindAllStringSubmatch(model, -1) {
		body := m[1]
		for _, ep := range acEndpoint.FindAllStringSubmatch(body, -1) {
			refs[ep[1]] = true
		}
	}

	return refs
}

// validateModel checks that every class referenced in an association or isA
// is also defined as a class.  Returns a list of dangling names.
func validateModel(model string) []string {
	defined := definedClasses(model)
	referenced := referencedClasses(model)
	var dangling []string
	for name := range referenced {
		if !defined[name] {
			dangling = append(dangling, name)
		}
	}
	return dangling
}

// simulateRenameClass applies umplesync's class-definition rename (which
// only changes the "class OldName" line), followed by our
// renameClassReferences post-processing that fixes all remaining refs.
func simulateRenameClass(content string, oldName, newName string) string {
	// Step 1: simulate umplesync's -editClass — renames the class def.
	defPat := `(?m)^(\s*class\s+)` + regexp.QuoteMeta(oldName) + `(\b)`
	if re, err := regexp.Compile(defPat); err == nil {
		content = re.ReplaceAllString(content, "${1}"+newName+"${2}")
	}
	// Also rename associationClass definitions.
	acDefPat := `(?m)^(\s*associationClass\s+)` + regexp.QuoteMeta(oldName) + `(\b)`
	if re, err := regexp.Compile(acDefPat); err == nil {
		content = re.ReplaceAllString(content, "${1}"+newName+"${2}")
	}

	// Step 2: our post-processing — fix dangling references.
	content = renameClassReferences(content, oldName, newName)

	return content
}

// simulateRemoveClass applies removeClassReferences (our cascade) then
// removes the class definition itself (simulating what umplesync does),
// and returns the resulting model text.
func simulateRemoveClass(content string, className string) string {
	// Step 1: cascade — remove references in other classes.
	content = removeClassReferences(content, className)

	// Step 2: simulate umplesync's -removeClass — remove the class block.
	// Match "class ClassName { ... }" (possibly multiline).
	pat := `(?m)^\s*class\s+` + regexp.QuoteMeta(className) + `\s*\{[^}]*\}[ \t]*\n?`
	if re, err := regexp.Compile(pat); err == nil {
		content = re.ReplaceAllString(content, "")
	}

	return content
}

// assertValidModel is a test helper that fails if the model has dangling refs.
func assertValidModel(t *testing.T, model string) {
	t.Helper()
	if dangling := validateModel(model); len(dangling) > 0 {
		t.Errorf("model has dangling references: %v\n--- model ---\n%s", dangling, model)
	}
}

func reserveTCPPort(t *testing.T) int {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve tcp port: %v", err)
	}
	defer listener.Close()

	return listener.Addr().(*net.TCPAddr).Port
}

func newIntegrationSyncHandler(t *testing.T) (*SyncHandler, *model.Store) {
	t.Helper()

	store, err := model.NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	jarPath := os.Getenv("UMPLE_SYNC_JAR")
	if jarPath == "" {
		jarPath = "/jars/umplesync.jar"
	}
	if _, err := os.Stat(jarPath); err != nil {
		t.Skipf("umplesync.jar not available: %v", err)
	}

	pool, err := compiler.NewPool(jarPath, reserveTCPPort(t))
	if err != nil {
		t.Fatalf("create compiler pool: %v", err)
	}
	t.Cleanup(pool.Shutdown)

	return NewSyncHandler(pool, store), store
}

func readExampleFixture(t *testing.T, name string) string {
	t.Helper()

	path := filepath.Join("..", "..", "..", "..", "examples", name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read example %s: %v", name, err)
	}
	return string(data)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestParseMethodParameters_UsesLegacyShapeAndExtractsTypes(t *testing.T) {
	got := parseMethodParameters("Facility facility, Map<String, Integer> permissionsByRole, RoleFacilityAccessRight")
	want := []map[string]string{
		encodeLegacyMethodParameter("Facility"),
		encodeLegacyMethodParameter("Map<String, Integer>"),
		encodeLegacyMethodParameter("RoleFacilityAccessRight"),
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected parameter encoding:\nwant: %#v\ngot:  %#v", want, got)
	}
}

func TestSyncAddMethod_AssociationClassAccessControlIsRejected(t *testing.T) {
	handler, store := newIntegrationSyncHandler(t)

	initialCode := readExampleFixture(t, "AccessControl.ump")
	modelRef, err := store.Create(initialCode)
	if err != nil {
		t.Fatalf("create model: %v", err)
	}

	body, err := json.Marshal(SyncRequest{
		Action:  "addMethod",
		ModelID: modelRef.ID,
		Params: map[string]string{
			"className":        "RoleFacilityAccessRight",
			"methodName":       "canAccess",
			"methodType":       "Boolean",
			"methodParameters": "",
		},
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/sync", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.Sync(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status %d:\n%s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(resp.Error, "association classes") {
		t.Fatalf("unexpected error message: %q", resp.Error)
	}

	modelDir := store.ModelDir(modelRef.ID)
	currentCode, err := os.ReadFile(filepath.Join(modelDir, model.DefaultEntryFile))
	if err != nil {
		t.Fatalf("read model after rejection: %v", err)
	}
	if string(currentCode) != initialCode {
		t.Fatalf("associationClass addMethod should not mutate the model:\n%s", currentCode)
	}
	if _, err := handler.generateModelJSON(filepath.Join(modelDir, model.DefaultEntryFile), modelDir); err != nil {
		t.Fatalf("original model should still compile after rejection: %v", err)
	}
}

func TestRemoveClass_StandaloneAssociationBlock(t *testing.T) {
	model := simulateRemoveClass(`class Auction { description; }
class ItemAtAuction { reserve; }
association { * Auction -- * ItemAtAuction; }
`, "ItemAtAuction")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Auction") {
		t.Error("Auction class should be preserved")
	}
}

func TestRemoveClass_NamedStandaloneAssociation(t *testing.T) {
	model := simulateRemoveClass(`class Vehicle {}
class Wheel {}
association VehicleWheels {
  0..1 Vehicle v <@>- 4 Wheel w;
}
`, "Vehicle")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Wheel") {
		t.Error("Wheel class should be preserved")
	}
}

func TestRemoveClass_MultipleStandaloneBlocks(t *testing.T) {
	model := simulateRemoveClass(`class A {}
class B {}
class C {}
association { * A -- * B; }
association { 1 A -- * C; }
association { * B -- * C; }
`, "A")

	assertValidModel(t, model)
	if !strings.Contains(model, "association { * B -- * C; }") {
		t.Error("association between B and C should be preserved")
	}
}

func TestRemoveClass_InlineAssociationRegular(t *testing.T) {
	model := simulateRemoveClass(`class Elevator {
 1 -- * ConsoleCallButton;
 1..* -- 0..* DownCallButton;
}
class ConsoleCallButton {}
class DownCallButton {}
class Floor {
 * -- * Elevator;
 1 -- * ConsoleCallButton;
}
`, "Elevator")

	assertValidModel(t, model)
	if !strings.Contains(model, "1 -- * ConsoleCallButton;") {
		t.Error("Floor's association to ConsoleCallButton should be preserved")
	}
}

func TestRemoveClass_InlineAssociationDirected(t *testing.T) {
	model := simulateRemoveClass(`class FacilityType {}
class Facility {
 * -> 0..1 FacilityType;
 name;
}
`, "FacilityType")

	assertValidModel(t, model)
	if !strings.Contains(model, "name;") {
		t.Error("Facility's attribute should be preserved")
	}
}

func TestRemoveClass_InlineAssociationComposition(t *testing.T) {
	model := simulateRemoveClass(`class Building {}
class Room {}
class Floor {
 4..10 -<@> 1 Building b;
 1 <@>- 0..6 Room r;
}
`, "Building")

	assertValidModel(t, model)
	if !strings.Contains(model, "Room") {
		t.Error("composition referencing Room should be preserved")
	}
}

func TestRemoveClass_InlineAssociationWithRoles(t *testing.T) {
	model := simulateRemoveClass(`class Course {}
class Topic {}
class PrerequisiteReason {
 * sucReason -- 1 Course successor;
 * preReason -- 1 Course prerequisite;
 * -- * Topic materialNeededBySuccessor;
}
`, "Course")

	assertValidModel(t, model)
	if !strings.Contains(model, "Topic materialNeededBySuccessor") {
		t.Error("association referencing Topic should be preserved")
	}
}

func TestRemoveClass_IsAGeneralization(t *testing.T) {
	model := simulateRemoveClass(`class MovementLocation {}
class Bin {
 isA MovementLocation;
 name;
}
class Shelf {
 isA MovementLocation;
 level;
}
`, "MovementLocation")

	assertValidModel(t, model)
	if !strings.Contains(model, "name;") || !strings.Contains(model, "level;") {
		t.Error("child class attributes should be preserved")
	}
}

func TestRemoveClass_IsAInSingleLineClass(t *testing.T) {
	// Single-line class definitions: "class Foo { isA Bar; attr; }"
	// The isA clause must be removed without deleting the whole class.
	model := simulateRemoveClass(`class Publication {
 name;
 1 -- * EditionOrIssue;
}
class EditionOrIssue { issueNumber; }
class EditionOfBook { isbn; libOfCongress; isA EditionOrIssue; }
class IssueOfPeriodical { volume; isA EditionOrIssue; }
class Periodical { issn; isA Publication; }
`, "EditionOrIssue")

	assertValidModel(t, model)
	// Single-line classes should survive with their attributes intact.
	if !strings.Contains(model, "isbn;") || !strings.Contains(model, "libOfCongress;") {
		t.Error("EditionOfBook's attributes should be preserved")
	}
	if !strings.Contains(model, "volume;") {
		t.Error("IssueOfPeriodical's attribute should be preserved")
	}
	// Periodical's isA Publication is unrelated and must survive.
	if !strings.Contains(model, "isA Publication;") {
		t.Error("Periodical's isA Publication should be preserved")
	}
	if strings.Contains(model, "isA EditionOrIssue") {
		t.Error("all isA EditionOrIssue references should be removed")
	}
}

func TestRemoveClass_IsADoesNotRemoveUnrelated(t *testing.T) {
	model := simulateRemoveClass(`class Button {}
class CloseDoorButton {
 isA Button;
}
class OpenDoorButton {
 isA Button;
}
`, "CloseDoorButton")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA Button;") {
		t.Error("OpenDoorButton's isA Button should be preserved")
	}
}

func TestRemoveClass_PreservesAttributes(t *testing.T) {
	model := simulateRemoveClass(`class Address {}
class Person {
 name;
 * -- * Address;
}
`, "Address")

	assertValidModel(t, model)
	if !strings.Contains(model, "name;") {
		t.Error("attribute should be preserved")
	}
}

func TestRemoveClass_PreservesDelimiterAndPositions(t *testing.T) {
	model := simulateRemoveClass(`class A {}
class B {
 * -- * A;
}
//$?[End_of_model]$?
class A {
 position 50 50 109 41;
}
class B {
 position 200 50 109 41;
}
`, "A")

	assertValidModel(t, model)
	if !strings.Contains(model, modelDelimiter) {
		t.Error("delimiter should be preserved")
	}
}

func TestRemoveClass_ConsecutiveAssociationLines(t *testing.T) {
	// Regression: \s* was consuming newlines, breaking ^ anchoring for
	// the next matching line.
	model := simulateRemoveClass(`class Course {}
class Topic {}
class MutualExclusionReason {
 * mutex -- 1 Course;
 * -- 1 Course isMutuallyExclusiveWith;
 * -- * Topic overlappingMaterial;
}
`, "Course")

	assertValidModel(t, model)
	if !strings.Contains(model, "Topic overlappingMaterial") {
		t.Error("unrelated association should be preserved")
	}
}

func TestRemoveClass_MixedReferences(t *testing.T) {
	model := simulateRemoveClass(`class Shape {}
class Circle {
 isA Shape;
 radius;
}
class Canvas {}
class Drawing {
 1 <@>- * Shape shapes;
 name;
}
association { * Drawing -- * Canvas; }
`, "Shape")

	assertValidModel(t, model)
	if !strings.Contains(model, "radius;") {
		t.Error("Circle's attribute should be preserved")
	}
	if !strings.Contains(model, "name;") {
		t.Error("Drawing's attribute should be preserved")
	}
	if !strings.Contains(model, "association { * Drawing -- * Canvas; }") {
		t.Error("unrelated association should be preserved")
	}
}

func TestRemoveClass_NoFalsePositivesOnSubstring(t *testing.T) {
	// "Course" should not match "CourseSection" or "AdvancedCourse".
	model := simulateRemoveClass(`class Course {}
class CourseSection {
 * -- * CourseSection;
}
class AdvancedCourse {
 isA CourseSection;
}
`, "Course")

	assertValidModel(t, model)
	if !strings.Contains(model, "* -- * CourseSection;") {
		t.Error("CourseSection self-association should be preserved")
	}
	if !strings.Contains(model, "isA CourseSection;") {
		t.Error("isA CourseSection should be preserved")
	}
}

func TestRemoveClass_EmptyContent(t *testing.T) {
	got := removeClassReferences("", "Foo")
	if got != "" {
		t.Errorf("empty content should remain empty, got: %q", got)
	}
}

func TestRemoveClass_NoReferences(t *testing.T) {
	content := `class A { name; }
class B { value; }
`
	got := removeClassReferences(content, "C")
	if got != content {
		t.Errorf("content should be unchanged when class has no references, got:\n%s", got)
	}
}

func TestRemoveClass_ClassNameNeedsRegexEscaping(t *testing.T) {
	content := `class Foo {}
class Bar {
 * -- * Foo;
}
`
	got := removeClassReferences(content, "Foo+Bar")
	if got != content {
		t.Error("content should be unchanged when class name doesn't match anything")
	}
}

// ---------------------------------------------------------------------------
// Full model scenarios from real examples
// ---------------------------------------------------------------------------

func TestRemoveClass_Compositions(t *testing.T) {
	model := simulateRemoveClass(`class Building {}
class Floor {
 4..10 -<@> 1 Building b;
 1 <@>- 0..6 Room r;
}
class Room {
 1 r -- * Person p;
 int windows = 6;
}
class Person {
 1 p -- 1..2 Vehicle v;
 name;
}
class Vehicle {}
class Wheel {}
association {
 0..1 Vehicle v <@>- 4 Wheel w;
}
`, "Building")

	assertValidModel(t, model)
}

func TestRemoveClass_ElevatorSystem(t *testing.T) {
	model := simulateRemoveClass(`class Elevator {
 1 -- * ConsoleCallButton;
 1..* -- 0..* DownCallButton;
 1..* -- 0..* UpCallButton;
}
class Floor {
 1 -- * ConsoleCallButton;
 * -- * Elevator;
}
class FullSystem {
 1 -- * Elevator;
}
class ConsoleCallButton {}
class DownCallButton {}
class UpCallButton {}
class Button {}
class CloseDoorButton {
 isA Button;
 1 -- 1 Elevator;
}
class OpenDoorButton {
 isA Button;
 1 -- 1 Elevator;
}
class UpCallButton {
 isA Button;
}
`, "Elevator")

	assertValidModel(t, model)
}

func TestRemoveClass_UniversitySystem(t *testing.T) {
	model := simulateRemoveClass(`class Course {}
class Topic {}
class PrerequisiteReason {
 * sucReason -- 1 Course successor;
 * preReason -- 1 Course prerequisite;
 * -- * Topic materialNeededBySuccessor;
}
class MutualExclusionReason {
 * mutex -- 1 Course;
 * -- 1 Course isMutuallyExclusiveWith;
 * -- * Topic overlappingMaterial;
}
`, "Course")

	assertValidModel(t, model)
}

func TestRemoveClass_WarehouseSystem(t *testing.T) {
	model := simulateRemoveClass(`class MovementLocation {}
class Bin {
 isA MovementLocation;
 name;
}
class Shelf {
 isA MovementLocation;
 level;
}
class RwbmMovement {
 * toMovement -- 1 MovementLocation to;
 * fromMovement -- 1 MovementLocation from;
 date;
}
`, "MovementLocation")

	assertValidModel(t, model)
}

func TestRemoveClass_GenealogyWithSelfRef(t *testing.T) {
	model := simulateRemoveClass(`class Person {}
class Union {
 * -- 0..2 Person partner;
}
class NameRecord {
 * Person child -- 0..1 Union parents;
}
`, "Person")

	assertValidModel(t, model)
}

func TestRemoveClass_AccessControlDirected(t *testing.T) {
	model := simulateRemoveClass(`class FacilityType {}
class Facility {
 * -> 0..1 FacilityType;
 name;
}
class FunctionalArea {
 0..1 parent -- * FunctionalArea child;
 * FunctionalArea -- * Facility;
}
`, "FacilityType")

	assertValidModel(t, model)
	// FunctionalArea self-association should survive.
	if !strings.Contains(model, "0..1 parent -- * FunctionalArea child;") {
		t.Error("FunctionalArea self-association should be preserved")
	}
}

func TestRemoveClass_AssociationClassPreservesUnrelated(t *testing.T) {
	model := simulateRemoveClass(`class A {}
class B {}
class C {}
associationClass AB {
 * A;
 * B;
}
associationClass BC {
 * B;
 * C;
}
`, "A")

	assertValidModel(t, model)
	if strings.Contains(model, "associationClass AB") {
		t.Error("associationClass AB referencing A should be removed")
	}
	if !strings.Contains(model, "associationClass BC") {
		t.Error("associationClass BC should be preserved")
	}
}

func TestRemoveClass_AccessControlFull(t *testing.T) {
	// Mirrors the AccessControl.ump example that triggered the original bug.
	model := simulateRemoveClass(`class FacilityType {
 code;
 description { Menu, Record, Screen }
}
class FunctionalArea {
 String code;
 0..1 parent -- * FunctionalArea child;
}
association {
 * FunctionalArea -- * Facility;
}
class Facility {
 Integer id;
 * -> 0..1 FacilityType;
 Integer access_count;
 name;
}
class Role {
 code;
}
class User {
 Integer id;
 * -> 0..1 Role;
 first_name;
}
associationClass RoleFacilityAccessRight {
 * Facility;
 * Role;
 CRUD_Value { R, RW }
}
`, "Facility")

	assertValidModel(t, model)
	if !strings.Contains(model, "class FacilityType") {
		t.Error("FacilityType should be preserved")
	}
	if !strings.Contains(model, "class Role") {
		t.Error("Role should be preserved")
	}
	if strings.Contains(model, "associationClass") {
		t.Error("associationClass referencing Facility should be removed")
	}
	if !strings.Contains(model, "0..1 parent -- * FunctionalArea child;") {
		t.Error("FunctionalArea self-association should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Sorted associations
// ---------------------------------------------------------------------------

func TestRemoveClass_SortedAssociation(t *testing.T) {
	model := simulateRemoveClass(`class Academy {
 1 -- * Course;
 1 -- * Student registrants sorted {id};
}
class Student {
 Integer id;
 name;
}
class Course {
 code;
}
class Registration {
 * -- 1 Student;
 * sorted {name} -- 1 Course;
}
`, "Student")

	assertValidModel(t, model)
	if !strings.Contains(model, "1 -- * Course;") {
		t.Error("Academy -> Course should be preserved")
	}
	if strings.Contains(model, "sorted {id}") {
		t.Error("sorted association referencing Student should be removed")
	}
	// Registration's sorted association to Course has no Student reference — must survive.
	if !strings.Contains(model, "* sorted {name} -- 1 Course;") {
		t.Error("Registration -> Course sorted association should be preserved")
	}
}

// ---------------------------------------------------------------------------
// AssociationClass: quaternary (4 endpoints)
// ---------------------------------------------------------------------------

func TestRemoveClass_AssociationClassQuaternary(t *testing.T) {
	// From AssociationClassDefinition3.ump
	model := simulateRemoveClass(`class SportsPlayer {
 name;
}
class Season {
 year;
}
class PlayingPosition {
 description;
}
class Team {
 name;
}
associationClass PlayerInPosition {
 Integer points;
 * SportsPlayer player;
 * Season;
 * Team;
 * PlayingPosition position;
}
`, "Season")

	assertValidModel(t, model)
	if strings.Contains(model, "associationClass") {
		t.Error("quaternary associationClass referencing Season should be removed")
	}
	if !strings.Contains(model, "class SportsPlayer") {
		t.Error("SportsPlayer should be preserved")
	}
	if !strings.Contains(model, "class Team") {
		t.Error("Team should be preserved")
	}
}

// ---------------------------------------------------------------------------
// AssociationClass: reflexive (same class at both ends)
// ---------------------------------------------------------------------------

func TestRemoveClass_AssociationClassReflexive(t *testing.T) {
	// From AssociationClassDefinition5.ump
	model := simulateRemoveClass(`class Member {
 name;
}
associationClass Assignment {
 Date dateEstablished;
 * menteeAssignments Member mentor;
 * mentorAssignments Member mentee;
}
`, "Member")

	assertValidModel(t, model)
	if strings.Contains(model, "associationClass") {
		t.Error("reflexive associationClass referencing Member should be removed")
	}
}

// ---------------------------------------------------------------------------
// AssociationClass: with named role on endpoint
// ---------------------------------------------------------------------------

func TestRemoveClass_AssociationClassWithRoles(t *testing.T) {
	// From AssociationClassDefinition1.ump
	model := simulateRemoveClass(`associationClass Ticket {
 Integer ticketNumber;
 Double price;
 * Person attendee;
 * Seminar;
}
class Person {
 name;
}
class Seminar {
 Date when;
 address;
}
`, "Person")

	assertValidModel(t, model)
	if strings.Contains(model, "associationClass") {
		t.Error("associationClass referencing Person should be removed")
	}
	if !strings.Contains(model, "class Seminar") {
		t.Error("Seminar should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Parametric / generic isA
// ---------------------------------------------------------------------------

func TestRemoveClass_ParametricIsA(t *testing.T) {
	// Note: assertValidModel not used here because the test validator
	// doesn't understand parametric/generic trait references like
	// TEquality<TP1=Color>.
	model := simulateRemoveClass(`class RootClass {
 abstract;
}
class Color {
 isA RootClass;
 isA TEquality<TP1=Color>;
 String rgb;
}
class Canvas {
 isA RootClass;
}
class GeometricObject {
 isA RootClass;
 isA Subject<Observer=Canvas>;
}
`, "Canvas")

	// isA Subject<Observer=Canvas> references Canvas and should be removed.
	if strings.Contains(model, "Canvas") {
		t.Error("all references to Canvas should be removed")
	}
	// Other isA lines must survive.
	if !strings.Contains(model, "isA RootClass;") {
		t.Error("isA RootClass should be preserved")
	}
	if !strings.Contains(model, "isA TEquality<TP1=Color>;") {
		t.Error("isA TEquality<TP1=Color> should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Multiple isA on separate lines — remove one parent
// ---------------------------------------------------------------------------

func TestRemoveClass_MultipleIsASeparateLines(t *testing.T) {
	model := simulateRemoveClass(`class GeometricObject {}
class TDrawable {}
class TDrawableWithEdge {}
class Shape2D {
 isA GeometricObject;
 isA TDrawableWithEdge;
 center;
}
class CurvedShape {
 isA Shape2D;
 isA TDrawable;
}
`, "TDrawableWithEdge")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA GeometricObject;") {
		t.Error("Shape2D's isA GeometricObject should be preserved")
	}
	if strings.Contains(model, "TDrawableWithEdge") {
		t.Error("all references to TDrawableWithEdge should be removed")
	}
	if !strings.Contains(model, "isA TDrawable;") {
		t.Error("CurvedShape's isA TDrawable should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Deep isA chain — remove middle class
// ---------------------------------------------------------------------------

func TestRemoveClass_DeepIsAChain(t *testing.T) {
	// From 2DShapes.ump: Shape2D -> EllipticalShape -> Circle/Ellipse
	model := simulateRemoveClass(`class Shape2D {
 center;
}
class EllipticalShape {
 isA Shape2D;
 semiMajorAxis;
}
class Polygon {
 isA Shape2D;
}
class Circle {
 isA EllipticalShape;
}
class Ellipse {
 isA EllipticalShape;
}
class SimplePolygon {
 isA Polygon;
 orientation;
}
`, "EllipticalShape")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA Shape2D;") {
		t.Error("Polygon's isA Shape2D should be preserved")
	}
	if !strings.Contains(model, "isA Polygon;") {
		t.Error("SimplePolygon's isA Polygon should be preserved")
	}
	if strings.Contains(model, "EllipticalShape") {
		t.Error("all references to EllipticalShape should be removed")
	}
}

// ---------------------------------------------------------------------------
// Directed association inside a trait block
// ---------------------------------------------------------------------------

func TestRemoveClass_AssociationInsideTrait(t *testing.T) {
	model := simulateRemoveClass(`class Color {
 String rgb;
}
class Circle {
 radius;
}
trait TDrawable {
 0..1 -> * Color;
}
`, "Color")

	assertValidModel(t, model)
	if strings.Contains(model, "Color") {
		t.Error("directed association to Color inside trait should be removed")
	}
	if !strings.Contains(model, "trait TDrawable") {
		t.Error("trait keyword should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Directed association in standalone block
// ---------------------------------------------------------------------------

func TestRemoveClass_DirectedInStandaloneBlock(t *testing.T) {
	model := simulateRemoveClass(`class Group {}
class Description {}
class Item {}
association {
 1 Group -> 0..1 Description;
}
association {
 * Group -- * Item;
}
`, "Description")

	assertValidModel(t, model)
	if !strings.Contains(model, "* Group -- * Item;") {
		t.Error("unrelated standalone association should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: ElectionSystem.ump — remove Candidature
// ---------------------------------------------------------------------------

func TestRemoveClass_ElectionSystem(t *testing.T) {
	model := simulateRemoveClass(`class PollingStation {
 Integer number;
 address;
 1 -- * PollInElection;
}
class ElectedBody {
 description;
 1 -- * Position;
}
class Election {
 1 -- * PollInElection;
 1 -- * ElectionForPosition;
}
class ElectionForPosition {
 1 -- * Candidature;
}
class Position {
 description;
 1 -- * ElectionForPosition;
}
class Candidature {
 internal Boolean isIncumbent;
}
class Candidate {
 name;
 1 -- * Candidature;
}
class PollInElection {
 Integer number;
 1 -- * Voter;
}
associationClass VotesInPoll {
 * Candidature;
 * PollInElection;
 Integer numVotes;
}
class Voter {
 name;
 address;
 * -- * Candidature;
}
class ElectoralDistrict {
 1 -- * Voter;
 0..1 -- * Position;
 0..1 -- * ElectoralDistrict subDistrict;
}
`, "Candidature")

	assertValidModel(t, model)
	if strings.Contains(model, "associationClass") {
		t.Error("associationClass VotesInPoll referencing Candidature should be removed")
	}
	if !strings.Contains(model, "1 -- * PollInElection;") {
		t.Error("PollingStation -> PollInElection should be preserved")
	}
	if !strings.Contains(model, "0..1 -- * ElectoralDistrict subDistrict;") {
		t.Error("ElectoralDistrict self-ref should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: Hotel.ump — remove RentableSpace
// ---------------------------------------------------------------------------

func TestRemoveClass_HotelSystem(t *testing.T) {
	model := simulateRemoveClass(`class HotelCompany {
 name;
 1 -- * Hotel owns;
}
class Hotel {
 name;
 address;
 1 -- * RentableSpace;
}
class ItemOnBill { description; charge; }
class Booking {
 startDate; endDate;
 1 -- * ItemOnBill;
 0..1 -- * Booking subsidiaryBooking;
}
class RentableSpace {
 costPerDay;
 * -- * Booking;
}
class HotelBedroom { isA RentableSpace; roomNumber; }
class MeetingRoom { isA RentableSpace; name; }
class Suite {
 1 -- * RentableSpace;
}
class Event { description; isA Booking; }
class Person {
 name; address;
 1 -- * Booking;
}
`, "RentableSpace")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA Booking;") {
		t.Error("Event's isA Booking should be preserved")
	}
	if !strings.Contains(model, "1 -- * ItemOnBill;") {
		t.Error("Booking -> ItemOnBill should be preserved")
	}
	if !strings.Contains(model, "0..1 -- * Booking subsidiaryBooking;") {
		t.Error("Booking self-ref should be preserved")
	}
	// HotelBedroom and MeetingRoom lose their isA but keep attributes.
	if !strings.Contains(model, "roomNumber;") {
		t.Error("HotelBedroom's attribute should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: Library.ump — remove EditionOrIssue
// ---------------------------------------------------------------------------

func TestRemoveClass_LibrarySystem(t *testing.T) {
	model := simulateRemoveClass(`class PartOfPublication {
 title; pageNumber;
 0..1 -- * PartOfPublication subparts;
}
class Copy { barCodeNumber; }
class EditionOrIssue {
 issueNumber;
 publishedDate;
 1 -- * PartOfPublication tableOfContents;
 1 -- * Copy;
}
class Publisher {
 name;
 1 -- * EditionOrIssue;
}
class Author {
 * -- * EditionOrIssue;
}
class EditionOfBook { isbn; isA EditionOrIssue; }
class IssueOfPeriodical { volume; isA EditionOrIssue; }
class Publication {
 name;
 1 -- * EditionOrIssue;
}
class Periodical { issn; frequency; isA Publication; }
class Book { isA Publication; }
`, "EditionOrIssue")

	assertValidModel(t, model)
	if !strings.Contains(model, "0..1 -- * PartOfPublication subparts;") {
		t.Error("PartOfPublication self-ref should be preserved")
	}
	if !strings.Contains(model, "isA Publication;") {
		t.Error("Periodical's isA Publication should be preserved")
	}
	if strings.Contains(model, "EditionOrIssue") {
		t.Error("all references to EditionOrIssue should be removed")
	}
}

// ---------------------------------------------------------------------------
// Full model: 2DShapes.ump — remove Shape2D (root of isA tree)
// ---------------------------------------------------------------------------

func TestRemoveClass_2DShapesSystem(t *testing.T) {
	model := simulateRemoveClass(`class Shape2D {
 center;
}
class EllipticalShape {
 isA Shape2D;
 semiMajorAxis;
}
class Polygon {
 isA Shape2D;
}
class Circle {
 isA EllipticalShape;
}
class Ellipse {
 isA EllipticalShape;
}
class SimplePolygon {
 orientation;
 isA Polygon;
}
class ArbitraryPolygon {
 points;
 isA Polygon;
}
class Rectangle {
 isA SimplePolygon;
 height;
 width;
}
class RegularPolygon {
 numPoints;
 radius;
 isA SimplePolygon;
}
`, "Shape2D")

	assertValidModel(t, model)
	// Only EllipticalShape and Polygon had isA Shape2D — rest of chain survives.
	if !strings.Contains(model, "isA EllipticalShape;") {
		t.Error("Circle's isA EllipticalShape should be preserved")
	}
	if !strings.Contains(model, "isA Polygon;") {
		t.Error("SimplePolygon's isA Polygon should be preserved")
	}
	if !strings.Contains(model, "isA SimplePolygon;") {
		t.Error("Rectangle's isA SimplePolygon should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: Airline.ump — remove SpecificFlight
// ---------------------------------------------------------------------------

func TestRemoveClass_AirlineSystem(t *testing.T) {
	model := simulateRemoveClass(`class Airline {
 1 -- * RegularFlight;
 1 -- * Person;
}
class RegularFlight {
 Integer flightNumber;
 1 -- * SpecificFlight;
}
class SpecificFlight {
 Date date;
}
class PassengerRole {
 isA PersonRole;
 1 -- * Booking;
}
class EmployeeRole {
 isA PersonRole;
 * -- 0..1 EmployeeRole supervisor;
 * -- * SpecificFlight;
}
class Person {
 name;
 1 -- 0..2 PersonRole;
}
class PersonRole {}
class Booking {
 seatNumber;
 * -- 1 SpecificFlight;
}
`, "SpecificFlight")

	assertValidModel(t, model)
	if !strings.Contains(model, "1 -- * RegularFlight;") {
		t.Error("Airline -> RegularFlight should be preserved")
	}
	if !strings.Contains(model, "* -- 0..1 EmployeeRole supervisor;") {
		t.Error("EmployeeRole self-ref should be preserved")
	}
	if !strings.Contains(model, "isA PersonRole;") {
		t.Error("isA PersonRole should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: Accommodations.ump — remove Unit
// ---------------------------------------------------------------------------

func TestRemoveClass_AccommodationsSystem(t *testing.T) {
	model := simulateRemoveClass(`class UnitFacility {
 unit_attribute_code;
}
class Location {
 Integer id;
 short_name;
}
association {
 * UnitFacility -- * Unit;
}
class Unit {
 id;
 Integer unit_number;
 * -> 0..1 Location;
 * hasUnit -> 0..1 UnitType type;
}
class UnitType {
 code;
 description { Apartment, House }
}
class ViewUnitStatus {
 Date status_date;
 * -- 0..1 Unit;
}
class BookingStatus {
 code;
 description { Confirmed, Provisional }
}
class UnitBooking {
 id;
 * -- 0..1 Unit;
 * -- 0..1 Guest;
 * -- 0..1 BookingStatus;
}
class Guest {
 id;
 first_name;
 * -> 1 Gender;
}
class Gender {
 code;
}
`, "Unit")

	assertValidModel(t, model)
	// Standalone association block referencing Unit should be removed.
	if strings.Contains(model, "association {") {
		t.Error("standalone association referencing Unit should be removed")
	}
	// Directed and inline associations in other classes referencing Unit should be removed.
	if strings.Contains(model, "Unit") {
		// Check only in the user-code section, not class names like UnitFacility.
		// UnitFacility, UnitType, UnitBooking all contain "Unit" as substring —
		// they must survive since \bUnit\b won't match.
		for _, must := range []string{"UnitFacility", "UnitType", "UnitBooking"} {
			if !strings.Contains(model, must) {
				t.Errorf("%s should be preserved (substring of Unit)", must)
			}
		}
	}
	// Guest's directed association to Gender should survive.
	if !strings.Contains(model, "* -> 1 Gender;") {
		t.Error("Guest -> Gender should be preserved")
	}
	if !strings.Contains(model, "* -- 0..1 BookingStatus;") {
		t.Error("UnitBooking -> BookingStatus should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: GenealogyB.ump — remove Person (self-ref standalone blocks)
// ---------------------------------------------------------------------------

func TestRemoveClass_GenealogyBSystem(t *testing.T) {
	model := simulateRemoveClass(`class Person {
 name;
 sex;
 placeOfBirth;
}
class Union {
 placeOfMarriage;
 dateOfMarriage;
 * -- 0..2 Person partner;
}
association {
 * Person child -- 0..1 Union parents;
}
association {
 0..2 Person adoptiveParents -- * Person adoptedChild;
}
`, "Person")

	assertValidModel(t, model)
	if strings.Contains(model, "association {") {
		t.Error("both standalone associations referencing Person should be removed")
	}
	// Union's inline association also references Person.
	if strings.Contains(model, "partner") {
		t.Error("Union's inline association to Person should be removed")
	}
	if !strings.Contains(model, "placeOfMarriage;") {
		t.Error("Union's attributes should be preserved")
	}
}

// ===========================================================================
// Rename tests — renameClassReferences
// ===========================================================================

// ---------------------------------------------------------------------------
// Basic rename patterns
// ---------------------------------------------------------------------------

func TestRenameClass_InlineAssociation(t *testing.T) {
	model := simulateRenameClass(`class Student {}
class Course {
 * -- * Student;
 code;
}
`, "Student", "Learner")

	assertValidModel(t, model)
	if strings.Contains(model, "Student") {
		t.Error("all references to Student should be renamed")
	}
	if !strings.Contains(model, "class Learner") {
		t.Error("class should be renamed to Learner")
	}
	if !strings.Contains(model, "* -- * Learner;") {
		t.Error("inline association should reference Learner")
	}
}

func TestRenameClass_DirectedAssociation(t *testing.T) {
	model := simulateRenameClass(`class FacilityType {}
class Facility {
 * -> 0..1 FacilityType;
 name;
}
`, "FacilityType", "FacilityCategory")

	assertValidModel(t, model)
	if strings.Contains(model, "FacilityType") {
		t.Error("all references to FacilityType should be renamed")
	}
	if !strings.Contains(model, "* -> 0..1 FacilityCategory;") {
		t.Error("directed association should reference FacilityCategory")
	}
}

func TestRenameClass_StandaloneAssociationBlock(t *testing.T) {
	model := simulateRenameClass(`class FunctionalArea {}
class Facility { name; }
association {
 * FunctionalArea -- * Facility;
}
`, "Facility", "Building")

	assertValidModel(t, model)
	if !strings.Contains(model, "* FunctionalArea -- * Building;") {
		t.Error("standalone association should reference Building")
	}
	if !strings.Contains(model, "class Building") {
		t.Error("class should be renamed to Building")
	}
}

func TestRenameClass_NamedStandaloneAssociation(t *testing.T) {
	model := simulateRenameClass(`class Vehicle {}
class Wheel {}
association VehicleWheels {
 0..1 Vehicle v <@>- 4 Wheel w;
}
`, "Vehicle", "Car")

	assertValidModel(t, model)
	if !strings.Contains(model, "0..1 Car v <@>- 4 Wheel w;") {
		t.Error("composition in standalone block should reference Car")
	}
}

func TestRenameClass_IsAGeneralization(t *testing.T) {
	model := simulateRenameClass(`class Shape2D { center; }
class EllipticalShape {
 isA Shape2D;
 semiMajorAxis;
}
class Circle {
 isA EllipticalShape;
}
`, "Shape2D", "Shape")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Shape {") {
		t.Error("class should be renamed to Shape")
	}
	if !strings.Contains(model, "isA Shape;") {
		t.Error("isA should reference Shape")
	}
	if !strings.Contains(model, "isA EllipticalShape;") {
		t.Error("Circle's isA should be unchanged")
	}
}

func TestRenameClass_IsAInSingleLineClass(t *testing.T) {
	model := simulateRenameClass(`class Publication { name; }
class EditionOrIssue { issueNumber; }
class Periodical { issn; isA Publication; }
class Book { isA Publication; }
`, "Publication", "PublishedWork")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA PublishedWork;") {
		t.Error("single-line isA should reference PublishedWork")
	}
	if strings.Contains(model, "Publication") {
		t.Error("all references to Publication should be renamed")
	}
}

func TestRenameClass_AssociationClassQuaternary(t *testing.T) {
	model := simulateRenameClass(`class SportsPlayer { name; }
class Season { year; }
class PlayingPosition { description; }
class Team { name; }
associationClass PlayerInPosition {
 Integer points;
 * SportsPlayer player;
 * Season;
 * Team;
 * PlayingPosition position;
}
`, "SportsPlayer", "Athlete")

	assertValidModel(t, model)
	if !strings.Contains(model, "* Athlete player;") {
		t.Error("quaternary associationClass should reference Athlete")
	}
	if !strings.Contains(model, "* Season;") {
		t.Error("other endpoints should be unchanged")
	}
}

func TestRenameClass_AssociationClassReflexive(t *testing.T) {
	model := simulateRenameClass(`class Member { name; }
associationClass Assignment {
 Date dateEstablished;
 * menteeAssignments Member mentor;
 * mentorAssignments Member mentee;
}
`, "Member", "Participant")

	assertValidModel(t, model)
	if strings.Contains(model, "Member") {
		t.Error("all references to Member should be renamed")
	}
	if !strings.Contains(model, "Participant mentor;") {
		t.Error("mentor endpoint should reference Participant")
	}
	if !strings.Contains(model, "Participant mentee;") {
		t.Error("mentee endpoint should reference Participant")
	}
}

// ---------------------------------------------------------------------------
// Rename: no false positives on substrings
// ---------------------------------------------------------------------------

func TestRenameClass_NoFalsePositivesOnSubstring(t *testing.T) {
	model := simulateRenameClass(`class Course { code; }
class CourseSection {
 * -- * CourseSection;
}
class AdvancedCourse {
 isA CourseSection;
}
`, "Course", "Module")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Module") {
		t.Error("Course should be renamed to Module")
	}
	// CourseSection and AdvancedCourse must NOT be affected.
	if !strings.Contains(model, "class CourseSection") {
		t.Error("CourseSection should be preserved (not a substring match)")
	}
	if !strings.Contains(model, "class AdvancedCourse") {
		t.Error("AdvancedCourse should be preserved")
	}
	if !strings.Contains(model, "isA CourseSection;") {
		t.Error("isA CourseSection should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Rename: self-referential association
// ---------------------------------------------------------------------------

func TestRenameClass_SelfReferentialAssociation(t *testing.T) {
	model := simulateRenameClass(`class FunctionalArea {
 String code;
 0..1 parent -- * FunctionalArea child;
}
`, "FunctionalArea", "Department")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Department") {
		t.Error("class should be renamed")
	}
	if !strings.Contains(model, "0..1 parent -- * Department child;") {
		t.Error("self-ref association should reference Department")
	}
}

// ---------------------------------------------------------------------------
// Rename: self-referential standalone association
// ---------------------------------------------------------------------------

func TestRenameClass_SelfRefStandaloneAssociation(t *testing.T) {
	model := simulateRenameClass(`class Person { name; }
association {
 0..2 Person adoptiveParents -- * Person adoptedChild;
}
`, "Person", "Individual")

	assertValidModel(t, model)
	if !strings.Contains(model, "0..2 Individual adoptiveParents -- * Individual adoptedChild;") {
		t.Error("both sides of self-ref standalone association should be renamed")
	}
}

// ---------------------------------------------------------------------------
// Rename: sorted association
// ---------------------------------------------------------------------------

func TestRenameClass_SortedAssociation(t *testing.T) {
	model := simulateRenameClass(`class Academy {
 1 -- * Student registrants sorted {id};
}
class Student {
 Integer id;
}
`, "Student", "Learner")

	assertValidModel(t, model)
	if !strings.Contains(model, "* Learner registrants sorted {id};") {
		t.Error("sorted association should reference Learner")
	}
}

// ---------------------------------------------------------------------------
// Rename: parametric / generic isA
// ---------------------------------------------------------------------------

func TestRenameClass_ParametricIsA(t *testing.T) {
	model := simulateRenameClass(`class RootClass {}
class Color {
 isA RootClass;
 isA TEquality<TP1=Color>;
}
`, "Color", "Colour")

	// Don't assertValidModel — our validator doesn't understand generics.
	if !strings.Contains(model, "class Colour") {
		t.Error("class should be renamed")
	}
	if !strings.Contains(model, "isA TEquality<TP1=Colour>;") {
		t.Error("parametric isA should reference Colour")
	}
}

// ---------------------------------------------------------------------------
// Rename: composition
// ---------------------------------------------------------------------------

func TestRenameClass_Composition(t *testing.T) {
	model := simulateRenameClass(`class Building {}
class Floor {
 4..10 -<@> 1 Building b;
 1 <@>- 0..6 Room r;
}
class Room {}
`, "Building", "Tower")

	assertValidModel(t, model)
	if !strings.Contains(model, "4..10 -<@> 1 Tower b;") {
		t.Error("composition should reference Tower")
	}
	if !strings.Contains(model, "1 <@>- 0..6 Room r;") {
		t.Error("Room composition should be unchanged")
	}
}

// ---------------------------------------------------------------------------
// Rename: multiple isA on separate lines
// ---------------------------------------------------------------------------

func TestRenameClass_MultipleIsASeparateLines(t *testing.T) {
	model := simulateRenameClass(`class GeometricObject {}
class TDrawable {}
class TDrawableWithEdge {}
class Shape2D {
 isA GeometricObject;
 isA TDrawableWithEdge;
 center;
}
`, "GeometricObject", "GeoObject")

	assertValidModel(t, model)
	if !strings.Contains(model, "isA GeoObject;") {
		t.Error("isA should reference GeoObject")
	}
	if !strings.Contains(model, "isA TDrawableWithEdge;") {
		t.Error("other isA should be unchanged")
	}
}

// ---------------------------------------------------------------------------
// Rename: association inside trait
// ---------------------------------------------------------------------------

func TestRenameClass_AssociationInsideTrait(t *testing.T) {
	model := simulateRenameClass(`class Color { String rgb; }
trait TDrawable {
 0..1 -> * Color;
}
`, "Color", "Colour")

	if !strings.Contains(model, "0..1 -> * Colour;") {
		t.Error("trait's directed association should reference Colour")
	}
	if !strings.Contains(model, "class Colour") {
		t.Error("class should be renamed")
	}
}

// ---------------------------------------------------------------------------
// Rename: preserves delimiter and position section
// ---------------------------------------------------------------------------

func TestRenameClass_PreservesDelimiterAndPositions(t *testing.T) {
	model := simulateRenameClass(`class A {}
class B {
 * -- * A;
}
//$?[End_of_model]$?
class A {
 position 50 50 109 41;
}
class B {
 position 200 50 109 41;
 position.association A__B 109,20 0,20;
}
`, "A", "Alpha")

	if !strings.Contains(model, modelDelimiter) {
		t.Error("delimiter should be preserved")
	}
	// User-code section should be renamed.
	if !strings.Contains(model, "class Alpha {}") {
		t.Error("class A should be renamed to Alpha in user code")
	}
	if !strings.Contains(model, "* -- * Alpha;") {
		t.Error("association should reference Alpha")
	}
	// Position section should be untouched — umplesync handles it.
	if !strings.Contains(model, "position.association A__B") {
		t.Error("position section should NOT be modified")
	}
}

// ---------------------------------------------------------------------------
// Full model: AccessControl — rename Facility to Building
// ---------------------------------------------------------------------------

func TestRenameClass_AccessControlFull(t *testing.T) {
	model := simulateRenameClass(`class FacilityType {
 code;
 description { Menu, Record, Screen }
}
class FunctionalArea {
 String code;
 0..1 parent -- * FunctionalArea child;
}
association {
 * FunctionalArea -- * Facility;
}
class Facility {
 Integer id;
 * -> 0..1 FacilityType;
 Integer access_count;
 name;
}
class Role {
 code;
}
class User {
 Integer id;
 * -> 0..1 Role;
 first_name;
}
associationClass RoleFacilityAccessRight {
 * Facility;
 * Role;
 CRUD_Value { R, RW }
}
`, "Facility", "Building")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Building") {
		t.Error("Facility should be renamed to Building")
	}
	if !strings.Contains(model, "* FunctionalArea -- * Building;") {
		t.Error("standalone association should reference Building")
	}
	if !strings.Contains(model, "* Building;") {
		t.Error("associationClass endpoint should reference Building")
	}
	// FacilityType is a different class — must NOT be affected.
	if !strings.Contains(model, "class FacilityType") {
		t.Error("FacilityType should be preserved (substring)")
	}
	if !strings.Contains(model, "* -> 0..1 FacilityType;") {
		t.Error("directed assoc to FacilityType should be preserved")
	}
	if !strings.Contains(model, "0..1 parent -- * FunctionalArea child;") {
		t.Error("FunctionalArea self-ref should be preserved")
	}
}

// ---------------------------------------------------------------------------
// Full model: ElectionSystem — rename Candidature
// ---------------------------------------------------------------------------

func TestRenameClass_ElectionSystem(t *testing.T) {
	model := simulateRenameClass(`class PollingStation {
 1 -- * PollInElection;
}
class Election {
 1 -- * PollInElection;
 1 -- * ElectionForPosition;
}
class ElectionForPosition {
 1 -- * Candidature;
}
class Candidature {
 Boolean isIncumbent;
}
class Candidate {
 name;
 1 -- * Candidature;
}
class PollInElection {
 1 -- * Voter;
}
associationClass VotesInPoll {
 * Candidature;
 * PollInElection;
 Integer numVotes;
}
class Voter {
 name;
 * -- * Candidature;
}
class ElectoralDistrict {
 1 -- * Voter;
 0..1 -- * ElectoralDistrict subDistrict;
}
`, "Candidature", "Nomination")

	assertValidModel(t, model)
	if strings.Contains(model, "Candidature") {
		t.Error("all references to Candidature should be renamed")
	}
	if !strings.Contains(model, "1 -- * Nomination;") {
		t.Error("ElectionForPosition assoc should reference Nomination")
	}
	if !strings.Contains(model, "* Nomination;") {
		t.Error("associationClass endpoint should reference Nomination")
	}
	if !strings.Contains(model, "* -- * Nomination;") {
		t.Error("Voter assoc should reference Nomination")
	}
	if !strings.Contains(model, "0..1 -- * ElectoralDistrict subDistrict;") {
		t.Error("ElectoralDistrict self-ref should be unchanged")
	}
}

// ---------------------------------------------------------------------------
// Full model: Hotel — rename RentableSpace
// ---------------------------------------------------------------------------

func TestRenameClass_HotelSystem(t *testing.T) {
	model := simulateRenameClass(`class HotelCompany {
 name;
 1 -- * Hotel owns;
}
class Hotel {
 name;
 1 -- * RentableSpace;
}
class Booking {
 startDate;
 0..1 -- * Booking subsidiaryBooking;
}
class RentableSpace {
 costPerDay;
 * -- * Booking;
}
class HotelBedroom { isA RentableSpace; roomNumber; }
class MeetingRoom { isA RentableSpace; name; }
class Suite {
 1 -- * RentableSpace;
}
`, "RentableSpace", "Unit")

	assertValidModel(t, model)
	if strings.Contains(model, "RentableSpace") {
		t.Error("all references to RentableSpace should be renamed")
	}
	if !strings.Contains(model, "1 -- * Unit;") {
		t.Error("Hotel assoc should reference Unit")
	}
	// Single-line isA must also be renamed.
	if !strings.Contains(model, "isA Unit;") {
		t.Error("isA in single-line classes should reference Unit")
	}
	if !strings.Contains(model, "0..1 -- * Booking subsidiaryBooking;") {
		t.Error("Booking self-ref should be unchanged")
	}
}

// ---------------------------------------------------------------------------
// Full model: Airline — rename SpecificFlight
// ---------------------------------------------------------------------------

func TestRenameClass_AirlineSystem(t *testing.T) {
	model := simulateRenameClass(`class Airline {
 1 -- * RegularFlight;
 1 -- * Person;
}
class RegularFlight {
 Integer flightNumber;
 1 -- * SpecificFlight;
}
class SpecificFlight {
 Date date;
}
class EmployeeRole {
 isA PersonRole;
 * -- 0..1 EmployeeRole supervisor;
 * -- * SpecificFlight;
}
class Person {
 name;
 1 -- 0..2 PersonRole;
}
class PersonRole {}
class Booking {
 seatNumber;
 * -- 1 SpecificFlight;
}
`, "SpecificFlight", "ActualFlight")

	assertValidModel(t, model)
	if strings.Contains(model, "SpecificFlight") {
		t.Error("all references to SpecificFlight should be renamed")
	}
	if !strings.Contains(model, "1 -- * ActualFlight;") {
		t.Error("RegularFlight assoc should reference ActualFlight")
	}
	if !strings.Contains(model, "* -- * ActualFlight;") {
		t.Error("EmployeeRole assoc should reference ActualFlight")
	}
	if !strings.Contains(model, "* -- 0..1 EmployeeRole supervisor;") {
		t.Error("EmployeeRole self-ref should be unchanged")
	}
}

// ---------------------------------------------------------------------------
// Full model: Accommodations — rename Unit (substring of UnitType etc.)
// ---------------------------------------------------------------------------

func TestRenameClass_AccommodationsSystem(t *testing.T) {
	model := simulateRenameClass(`class UnitFacility { code; }
class Location { Integer id; short_name; }
association {
 * UnitFacility -- * Unit;
}
class Unit {
 id;
 * -> 0..1 Location;
 * hasUnit -> 0..1 UnitType type;
}
class UnitType {
 code;
 description { Apartment, House }
}
class ViewUnitStatus {
 Date status_date;
 * -- 0..1 Unit;
}
class UnitBooking {
 id;
 * -- 0..1 Unit;
 * -- 0..1 Guest;
}
class Guest { id; first_name; * -> 1 Gender; }
class Gender { code; }
`, "Unit", "Accommodation")

	assertValidModel(t, model)
	if !strings.Contains(model, "class Accommodation") {
		t.Error("Unit should be renamed to Accommodation")
	}
	// Substring classes must NOT be affected.
	if !strings.Contains(model, "class UnitFacility") {
		t.Error("UnitFacility should be preserved")
	}
	if !strings.Contains(model, "class UnitType") {
		t.Error("UnitType should be preserved")
	}
	if !strings.Contains(model, "class UnitBooking") {
		t.Error("UnitBooking should be preserved")
	}
	if !strings.Contains(model, "class ViewUnitStatus") {
		t.Error("ViewUnitStatus should be preserved")
	}
	// References to Unit should be renamed.
	if !strings.Contains(model, "* UnitFacility -- * Accommodation;") {
		t.Error("standalone association should reference Accommodation")
	}
	if !strings.Contains(model, "* -- 0..1 Accommodation;") {
		t.Error("inline associations should reference Accommodation")
	}
	// UnitType reference should be unchanged.
	if !strings.Contains(model, "* hasUnit -> 0..1 UnitType type;") {
		t.Error("directed assoc to UnitType should be preserved")
	}
}
