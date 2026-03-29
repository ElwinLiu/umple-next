package handlers

import (
	"regexp"
	"strings"
	"testing"
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

	// isA lines.
	isaLine := regexp.MustCompile(`(?m)^\s*isA\s+([^;]+);`)
	for _, m := range isaLine.FindAllStringSubmatch(model, -1) {
		for _, part := range strings.Split(m[1], ",") {
			name := strings.TrimSpace(part)
			if name != "" {
				refs[name] = true
			}
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
