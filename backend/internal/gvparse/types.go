package gvparse

// StateMachine represents a parsed state machine from a GV file.
type StateMachine struct {
	Name      string  `json:"name"`      // "ClassName.smName"
	ClassName string  `json:"className"`
	States    []State `json:"states"`
}

// State represents a single state within a state machine.
type State struct {
	Name         string       `json:"name"`
	EntryActions []string     `json:"entryActions,omitempty"`
	ExitActions  []string     `json:"exitActions,omitempty"`
	NestedStates []State      `json:"nestedStates,omitempty"`
	Transitions  []Transition `json:"transitions"`
	IsInitial    bool         `json:"isInitial,omitempty"`
}

// Transition represents a state transition.
type Transition struct {
	Event     string `json:"event"`
	Guard     string `json:"guard,omitempty"`
	Action    string `json:"action,omitempty"`
	NextState string `json:"nextState"`
}
