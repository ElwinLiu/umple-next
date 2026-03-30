package handlers

import (
	"strings"
	"testing"
)

func TestMergeModelCodeWithStoredLayout_PreservesMatchingHiddenLayout(t *testing.T) {
	existing := `class A {}
class B {}

//$?[End_of_model]$?
namespace -;

class A {
  position 10 20 109 41;
  position.association A__B 109,20 0,20;
}

class B {
  position 200 20 109 41;
}
`

	merged := mergeModelCodeWithStoredLayout("class A {}\nclass B {}\n", existing)

	if !containsAllParts(merged,
		modelDelimiter,
		"class A {\n  position 10 20 109 41;\n  position.association A__B 109,20 0,20;\n}",
		"class B {\n  position 200 20 109 41;\n}",
	) {
		t.Fatalf("expected merged model to preserve hidden layout section, got:\n%s", merged)
	}
}

func TestMergeModelCodeWithStoredLayout_PrunesDeletedClassifierLayout(t *testing.T) {
	existing := `class A {}
class B {}

//$?[End_of_model]$?
class A {
  position 10 20 109 41;
  position.association A__B 109,20 0,20;
}

class B {
  position 200 20 109 41;
}
`

	merged := mergeModelCodeWithStoredLayout("class A {}\n", existing)

	if strings.Contains(merged, "class B {\n  position 200 20 109 41;\n}") {
		t.Fatalf("expected deleted classifier layout to be pruned, got:\n%s", merged)
	}
	if !containsAllParts(merged,
		modelDelimiter,
		"class A {\n  position 10 20 109 41;\n  position.association A__B 109,20 0,20;\n}",
	) {
		t.Fatalf("expected surviving classifier layout to be preserved, got:\n%s", merged)
	}
}

func TestMergeModelCodeWithStoredLayout_StripsPositionsFromIncomingCode(t *testing.T) {
	// Example files from the old Umple repo include baked-in positions after
	// the delimiter.  These should be ignored — only positions persisted on
	// disk (from user drag operations) should be honoured.
	codeWithPositions := `class A {}
class B {}

//$?[End_of_model]$?
class A {
  position 10 20 109 41;
}

class B {
  position 200 20 109 41;
}
`
	existing := "" // no prior model on disk

	merged := mergeModelCodeWithStoredLayout(codeWithPositions, existing)

	if strings.Contains(merged, "position") {
		t.Fatalf("expected positions from incoming code to be stripped, got:\n%s", merged)
	}
	if strings.Contains(merged, modelDelimiter) {
		t.Fatalf("expected delimiter to be absent when no existing layout, got:\n%s", merged)
	}
}

func TestExtractStoredLayoutMetadata(t *testing.T) {
	code := `class A {}
class B {}

//$?[End_of_model]$?
namespace -;

class A {
  position 10 20 109 41;
  position.association A__B 109,20 0,20;
}

class B {
  position 200 20 109 41;
}
`

	meta := extractStoredLayoutMetadata(code)
	if meta == nil {
		t.Fatal("expected stored layout metadata")
	}
	if !meta.HasStoredLayout {
		t.Fatal("expected HasStoredLayout to be true")
	}
	if len(meta.NodeNames) != 2 || meta.NodeNames[0] != "A" || meta.NodeNames[1] != "B" {
		t.Fatalf("unexpected node names: %#v", meta.NodeNames)
	}
	if len(meta.AssociationNames) != 1 || meta.AssociationNames[0] != "A__B" {
		t.Fatalf("unexpected association names: %#v", meta.AssociationNames)
	}
}

func containsAllParts(s string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(s, part) {
			return false
		}
	}
	return true
}
