package model

// Model represents a saved Umple model on disk.
type Model struct {
	ID   string `json:"id"`
	Code string `json:"code"`
}

// TabIndex tracks the active tab and list of tab files for a model.
type TabIndex struct {
	Active string   `json:"active"`
	Tabs   []string `json:"tabs"`
}
