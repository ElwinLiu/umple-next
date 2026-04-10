package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umpleonline/backend/internal/model"
)

type ExampleHandler struct {
	examplePath string
	store       *model.Store
}

func NewExampleHandler(examplePath string, store *model.Store) *ExampleHandler {
	return &ExampleHandler{examplePath: examplePath, store: store}
}

type ExampleEntry struct {
	Name     string `json:"name"`
	Label    string `json:"label"`
	Filename string `json:"filename"`
}

type ExampleCategoryID string

const (
	ExampleCategoryClass     ExampleCategoryID = "class"
	ExampleCategoryState     ExampleCategoryID = "state"
	ExampleCategoryStructure ExampleCategoryID = "structure"
	ExampleCategoryFeature   ExampleCategoryID = "feature"
	ExampleCategoryOther     ExampleCategoryID = "other"
)

type ExampleCategory struct {
	ID       ExampleCategoryID `json:"id"`
	Label    string            `json:"label"`
	Name     string            `json:"name"`
	Examples []ExampleEntry    `json:"examples"`
}

type exampleCategoryDef struct {
	ID    ExampleCategoryID
	Label string
}

// categoryOrder defines the display order of example categories.
var categoryOrder = []exampleCategoryDef{
	{ID: ExampleCategoryClass, Label: "Class Diagrams"},
	{ID: ExampleCategoryState, Label: "State Machines"},
	{ID: ExampleCategoryStructure, Label: "Composite Structure"},
	{ID: ExampleCategoryFeature, Label: "Feature Diagrams"},
}

// hiddenExamples are present on disk but were intentionally not exposed in the
// legacy UmpleOnline picker.
var hiddenExamples = map[string]bool{
	"OBDCarSystem": true,
}

// categoryMembers maps each category to its curated list of example names
// (without .ump extension). Derived from legacy UmpleOnline (umple.php).
var categoryMembers = map[ExampleCategoryID][]string{
	ExampleCategoryClass: {
		"2DShapes", "AccessControl", "AccessControl2", "Accidents", "Accommodations",
		"AfghanRainDesign", "AirlineExample", "Auction", "BankingSystemA", "BankingSystemB",
		"CanalSystem", "Claim", "CommunityAssociation", "Compositions", "CoOpSystem",
		"DMMExtensionCTF", "DMMOverview", "DMMRelationshipHierarchy", "DMMSourceObjectHierarchy",
		"Decisions", "ElectionSystem", "ElevatorSystemA", "ElevatorSystemB",
		"GenealogyA", "GenealogyB", "GenealogyC", "GeographicalInformationSystem", "GeometricSystem",
		"Hospital", "Hotel", "Insurance", "InventoryManagement", "Library",
		"MailOrderSystemClientOrder", "ManufacturingPlantController", "OhHellWhist",
		"Pizza", "PoliceSystem", "PoliticalEntities", "RoutesAndLocations",
		"School", "TelephoneSystem", "UniversitySystem", "VendingMachineClassDiagram",
		"WarehouseSystem", "realestate",
	},
	ExampleCategoryState: {
		"AgentsCommunication", "ApplicationProcessing", "Auction", "Booking",
		"CanalLockStateMachine", "CarTransmission", "CollisionAvoidance",
		"CollisionAvoidanceA1", "CollisionAvoidanceA2", "CollisionAvoidanceA3",
		"ComplexStateMachine", "CourseSectionFlat", "CourseSectionNested",
		"DigitalWatchFlat", "DigitalWatchNested", "Dishwasher",
		"Elevator_State_Machine", "GarageDoor", "HomeHeater",
		"LibraryLoanStateMachine", "Lights", "MicrowaveOven2", "Ovens",
		"ParliamentBill", "Phone", "Runway", "SecurityLight",
		"SpecificFlight", "SpecificFlightFlat", "TcpIpSimulation",
		"TelephoneSystem2", "TicTacToe", "TimedCommands", "TollBooth",
		"TrafficLightsA", "TrafficLightsB",
	},
	ExampleCategoryStructure: {
		"PingPong", "OBDCarSystem",
	},
	ExampleCategoryFeature: {
		"BerkeleyDB_SPL", "BerkeleyDB_SP_featureDepend", "HelloWorld_SPL",
	},
}

// displayLabels maps example names to human-readable labels.
// Derived from legacy UmpleOnline (umple.php). Examples not listed here
// fall back to the auto-generated label from humanize().
var displayLabels = map[string]string{
	// Class Diagrams
	"2DShapes":                      "2DShapes *",
	"AccessControl":                 "Access Control",
	"AccessControl2":                "Access Control 2",
	"Accidents":                     "Accidents",
	"Accommodations":                "Accommodations",
	"AfghanRainDesign":              "Afghan Rain Design",
	"AirlineExample":                "Airline *",
	"Auction":                       "Auction *",
	"BankingSystemA":                "Banking System A",
	"BankingSystemB":                "Banking System B",
	"CanalSystem":                   "Canal",
	"Claim":                         "Claim (Insurance)",
	"CommunityAssociation":          "Community Association",
	"Compositions":                  "Compositions",
	"CoOpSystem":                    "Co-Op System",
	"DMMExtensionCTF":               "DMM CTF",
	"DMMOverview":                   "DMM Overview",
	"DMMRelationshipHierarchy":      "DMM Relationship Hierarchy",
	"DMMSourceObjectHierarchy":      "DMM Source Object Hierarchy",
	"Decisions":                     "Decisions",
	"ElectionSystem":                "Election System",
	"ElevatorSystemA":               "Elevator System A",
	"ElevatorSystemB":               "Elevator System B",
	"GenealogyA":                    "Genealogy A",
	"GenealogyB":                    "Genealogy B",
	"GenealogyC":                    "Genealogy C",
	"GeographicalInformationSystem": "Geographical Information System",
	"GeometricSystem":               "Geometric System",
	"Hospital":                      "Hospital",
	"Hotel":                         "Hotel",
	"Insurance":                     "Insurance",
	"InventoryManagement":           "Inventory Management",
	"Library":                       "Library",
	"MailOrderSystemClientOrder":    "Mail Order System - Client Order",
	"ManufacturingPlantController":  "Manufacturing Plant Controller",
	"OhHellWhist":                   "Card Games",
	"Pizza":                         "Pizza System",
	"PoliceSystem":                  "Police System",
	"PoliticalEntities":             "Political Entities",
	"realestate":                    "Real Estate",
	"RoutesAndLocations":            "Routes And Locations",
	"School":                        "School",
	"TelephoneSystem":               "Telephone System",
	"UniversitySystem":              "University System",
	"VendingMachineClassDiagram":    "Vending Machine",
	"WarehouseSystem":               "Warehouse System",
	// State Machines
	"AgentsCommunication":     "Agents Communicating *",
	"ApplicationProcessing":   "Application for a Grant",
	"Booking":                 "Booking (Airline)",
	"CanalLockStateMachine":   "Canal Lock",
	"CarTransmission":         "Car Transmission",
	"CollisionAvoidance":      "Collision Avoidance With And-Cross Transition",
	"CollisionAvoidanceA1":    "Collision Avoidance - Alternative 1",
	"CollisionAvoidanceA2":    "Collision Avoidance - Alternative 2",
	"CollisionAvoidanceA3":    "Collision Avoidance - Alternative 3",
	"ComplexStateMachine":     "Complex Symbolic *",
	"CourseSectionFlat":       "Course Section",
	"CourseSectionNested":     "Course Section (Nested)",
	"DigitalWatchFlat":        "Digital Watch (Flat) *",
	"DigitalWatchNested":      "Digital Watch Nested *",
	"Dishwasher":              "Dishwasher",
	"Elevator_State_Machine":  "Elevator",
	"GarageDoor":              "Garage Door",
	"HomeHeater":              "Home Heating System",
	"LibraryLoanStateMachine": "Library Loan",
	"Lights":                  "Light (3 alternatives)",
	"MicrowaveOven2":          "Microwave Oven *",
	"Ovens":                   "Oven (3 alternatives)",
	"ParliamentBill":          "Parliament Bill",
	"Phone":                   "Phone and Lines",
	"Runway":                  "Runway",
	"SecurityLight":           "Security Light",
	"SpecificFlight":          "Specific Flight (Airline)",
	"SpecificFlightFlat":      "Specific Flight (Airline - Flat)",
	"TcpIpSimulation":         "TCP/IP Simulation *",
	"TelephoneSystem2":        "Telephone Set Modes",
	"TicTacToe":               "Tic Tac Toe or Noughts and Crosses",
	"TimedCommands":           "Timed Commands *",
	"TollBooth":               "Toll Booth",
	"TrafficLightsA":          "Traffic Lights A",
	"TrafficLightsB":          "Traffic Lights B",
	// Composite Structure
	"PingPong":     "Ping Pong",
	"OBDCarSystem": "OBD Car System",
	// Feature Diagrams
	"BerkeleyDB_SPL":              "BerkeleyDB SPL",
	"BerkeleyDB_SP_featureDepend": "Feature Dependencies of BerkeleyDB SPL",
	"HelloWorld_SPL":              "HelloWorld SPL",
}

// labelFor returns the human-readable label for an example name.
func labelFor(name string) string {
	if l, ok := displayLabels[name]; ok {
		return l
	}
	return name
}

func (h *ExampleHandler) List(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(h.examplePath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]ExampleCategory{})
		return
	}

	// Build set of available .ump files
	available := make(map[string]bool)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".ump") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".ump")
		if hiddenExamples[name] {
			continue
		}
		available[name] = true
	}

	// Track which examples have been claimed by a category
	claimed := make(map[string]bool)

	var categories []ExampleCategory
	for _, category := range categoryOrder {
		members := categoryMembers[category.ID]
		var exs []ExampleEntry
		for _, name := range members {
			if available[name] {
				exs = append(exs, ExampleEntry{
					Name:     name,
					Label:    labelFor(name),
					Filename: name + ".ump",
				})
				claimed[name] = true
			}
		}
		if len(exs) > 0 {
			categories = append(categories, ExampleCategory{
				ID:       category.ID,
				Label:    category.Label,
				Name:     category.Label,
				Examples: exs,
			})
		}
	}

	// Collect unclaimed examples into "Other"
	var other []ExampleEntry
	for name := range available {
		if !claimed[name] {
			other = append(other, ExampleEntry{
				Name:     name,
				Label:    labelFor(name),
				Filename: name + ".ump",
			})
		}
	}
	if len(other) > 0 {
		sort.Slice(other, func(i, j int) bool {
			return strings.ToLower(other[i].Name) < strings.ToLower(other[j].Name)
		})
		categories = append(categories, ExampleCategory{
			ID:       ExampleCategoryOther,
			Label:    "Other",
			Name:     "Other",
			Examples: other,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

// categoryForExample returns the canonical category for the given example
// (without .ump extension), or empty string if uncategorized. Some examples
// appear in multiple categories, so this follows the display order above to
// choose the default category for URL/bootstrap flows.
func categoryForExample(name string) ExampleCategoryID {
	for _, category := range categoryOrder {
		if slices.Contains(categoryMembers[category.ID], name) {
			return category.ID
		}
	}
	return ""
}

func (h *ExampleHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	// Sanitize
	name = filepath.Base(name)
	if !strings.HasSuffix(name, ".ump") {
		name += ".ump"
	}

	data, err := os.ReadFile(filepath.Join(h.examplePath, name))
	if err != nil {
		writeError(w, http.StatusNotFound, "example not found")
		return
	}

	raw := string(data)
	userCode, _, hasDelimiter := splitModelSections(raw)

	baseName := strings.TrimSuffix(name, ".ump")
	resp := map[string]string{
		"name": baseName,
		"code": userCode,
	}

	if categoryID := categoryForExample(baseName); categoryID != "" {
		resp["defaultCategoryId"] = string(categoryID)
	}

	// If the example has a layout section, pre-create a model on disk with the
	// full content so that the first compile preserves the stored positions.
	if hasDelimiter {
		m, err := h.store.Create(raw)
		if err == nil {
			resp["modelId"] = m.ID
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
