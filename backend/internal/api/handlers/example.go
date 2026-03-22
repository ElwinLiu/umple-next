package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
)

type ExampleHandler struct {
	examplePath string
}

func NewExampleHandler(examplePath string) *ExampleHandler {
	return &ExampleHandler{examplePath: examplePath}
}

type ExampleEntry struct {
	Name     string `json:"name"`
	Filename string `json:"filename"`
}

type ExampleCategory struct {
	Name     string         `json:"name"`
	Examples []ExampleEntry `json:"examples"`
}

// categoryOrder defines the display order of example categories.
var categoryOrder = []string{
	"Class Diagrams",
	"State Machines",
	"Composite Structure",
	"Feature Diagrams",
}

// categoryMembers maps each category to its curated list of example names
// (without .ump extension). Derived from legacy UmpleOnline (umple.php).
var categoryMembers = map[string][]string{
	"Class Diagrams": {
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
	"State Machines": {
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
	"Composite Structure": {
		"PingPong", "OBDCarSystem",
	},
	"Feature Diagrams": {
		"BerkeleyDB_SPL", "BerkeleyDB_SP_featureDepend", "HelloWorld_SPL",
	},
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
		available[name] = true
	}

	// Track which examples have been claimed by a category
	claimed := make(map[string]bool)

	var categories []ExampleCategory
	for _, catName := range categoryOrder {
		members := categoryMembers[catName]
		var exs []ExampleEntry
		for _, name := range members {
			if available[name] {
				exs = append(exs, ExampleEntry{
					Name:     name,
					Filename: name + ".ump",
				})
				claimed[name] = true
			}
		}
		if len(exs) > 0 {
			categories = append(categories, ExampleCategory{
				Name:     catName,
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
				Filename: name + ".ump",
			})
		}
	}
	if len(other) > 0 {
		sort.Slice(other, func(i, j int) bool {
			return strings.ToLower(other[i].Name) < strings.ToLower(other[j].Name)
		})
		categories = append(categories, ExampleCategory{
			Name:     "Other",
			Examples: other,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"name": strings.TrimSuffix(name, ".ump"),
		"code": string(data),
	})
}
