package crud

import (
	"encoding/json"
	"testing"
)

func TestFlexBool(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"string true", `{"isAbstract":"true"}`, true},
		{"string false", `{"isAbstract":"false"}`, false},
		{"bool true", `{"isAbstract":true}`, true},
		{"bool false", `{"isAbstract":false}`, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var c RawClass
			if err := json.Unmarshal([]byte(tt.input), &c); err != nil {
				t.Fatalf("unmarshal error: %v", err)
			}
			if bool(c.IsAbstract) != tt.want {
				t.Errorf("got %v, want %v", c.IsAbstract, tt.want)
			}
		})
	}
}

func TestRawModelUnmarshal(t *testing.T) {
	// Real compiler output (abbreviated)
	input := `{"umpleClasses":[{"name":"Student","isAbstract":"false","attributes":[{"name":"name","type":"String"}],"methods":[],"enums":[]}],"umpleAssociations":[],"globalEnums":[]}`
	var m RawModel
	if err := json.Unmarshal([]byte(input), &m); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if len(m.UmpleClasses) != 1 {
		t.Fatalf("expected 1 class, got %d", len(m.UmpleClasses))
	}
	if m.UmpleClasses[0].Name != "Student" {
		t.Errorf("name = %q, want Student", m.UmpleClasses[0].Name)
	}
	if bool(m.UmpleClasses[0].IsAbstract) != false {
		t.Error("expected isAbstract = false")
	}
}

func TestParseMultiplicity(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantMin int
		wantMax int
	}{
		{"star", "*", 0, -1},
		{"zero to one", "0..1", 0, 1},
		{"exactly one", "1", 1, 1},
		{"one to many", "1..*", 1, -1},
		{"range", "3..7", 3, 7},
		{"empty", "", 0, -1},
		{"zero to many", "0..*", 0, -1},
		{"exactly zero", "0", 0, 0},
		{"exactly five", "5", 5, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseMultiplicity(tt.input)
			if got.Min != tt.wantMin {
				t.Errorf("ParseMultiplicity(%q).Min = %d, want %d", tt.input, got.Min, tt.wantMin)
			}
			if got.Max != tt.wantMax {
				t.Errorf("ParseMultiplicity(%q).Max = %d, want %d", tt.input, got.Max, tt.wantMax)
			}
			if got.Raw != tt.input {
				t.Errorf("ParseMultiplicity(%q).Raw = %q, want %q", tt.input, got.Raw, tt.input)
			}
		})
	}
}

func TestClassifyType(t *testing.T) {
	classNames := map[string]bool{"Department": true, "Address": true}
	enumNames := map[string]bool{"Status": true, "Priority": true}

	tests := []struct {
		name string
		typ  string
		want string
	}{
		{"string", "String", "primitive"},
		{"integer", "Integer", "primitive"},
		{"int", "int", "primitive"},
		{"boolean", "Boolean", "primitive"},
		{"double", "Double", "primitive"},
		{"float", "Float", "primitive"},
		{"date", "Date", "primitive"},
		{"time", "Time", "primitive"},
		{"known class", "Department", "class"},
		{"known class 2", "Address", "class"},
		{"known enum", "Status", "enum"},
		{"known enum 2", "Priority", "enum"},
		{"unknown defaults to primitive", "SomeUnknownType", "primitive"},
		{"empty", "", "primitive"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClassifyType(tt.typ, classNames, enumNames)
			if got != tt.want {
				t.Errorf("ClassifyType(%q) = %q, want %q", tt.typ, got, tt.want)
			}
		})
	}
}

func TestBuildInheritanceChain(t *testing.T) {
	classes := map[string]*RawClass{
		"Animal":  {Name: "Animal"},
		"Dog":     {Name: "Dog", ExtendsClass: "Animal"},
		"Puppy":   {Name: "Puppy", ExtendsClass: "Dog"},
		"Orphan":  {Name: "Orphan"},
	}

	tests := []struct {
		name      string
		className string
		want      []string // expected class names in chain order
	}{
		{"no parent", "Orphan", []string{"Orphan"}},
		{"single parent", "Dog", []string{"Dog", "Animal"}},
		{"deep chain", "Puppy", []string{"Puppy", "Dog", "Animal"}},
		{"root class", "Animal", []string{"Animal"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildInheritanceChain(tt.className, classes)
			if len(got) != len(tt.want) {
				t.Fatalf("BuildInheritanceChain(%q) returned %d classes, want %d", tt.className, len(got), len(tt.want))
			}
			for i, name := range tt.want {
				if got[i].Name != name {
					t.Errorf("chain[%d] = %q, want %q", i, got[i].Name, name)
				}
			}
		})
	}

	// Circular reference guard
	t.Run("circular reference", func(t *testing.T) {
		circular := map[string]*RawClass{
			"A": {Name: "A", ExtendsClass: "B"},
			"B": {Name: "B", ExtendsClass: "A"},
		}
		got := BuildInheritanceChain("A", circular)
		// Should terminate without infinite loop; exact result depends on impl
		if len(got) == 0 {
			t.Error("expected non-empty chain even with circular reference")
		}
	})
}

func TestFlattenAttributes(t *testing.T) {
	classes := map[string]*RawClass{
		"Animal": {
			Name: "Animal",
			Attributes: []RawAttribute{
				{Name: "name", Type: "String"},
				{Name: "age", Type: "Integer"},
			},
		},
		"Dog": {
			Name:         "Dog",
			ExtendsClass: "Animal",
			Attributes: []RawAttribute{
				{Name: "breed", Type: "String"},
			},
		},
		"Puppy": {
			Name:         "Puppy",
			ExtendsClass: "Dog",
			Attributes: []RawAttribute{
				{Name: "trained", Type: "Boolean"},
			},
		},
	}
	classNames := map[string]bool{"Animal": true, "Dog": true, "Puppy": true}
	enumNames := map[string]bool{}

	t.Run("no inheritance", func(t *testing.T) {
		attrs := FlattenAttributes("Animal", classes, classNames, enumNames)
		if len(attrs) != 2 {
			t.Fatalf("got %d attrs, want 2", len(attrs))
		}
		if attrs[0].Name != "name" || attrs[0].IsInherited {
			t.Errorf("attrs[0] = %+v, want own 'name'", attrs[0])
		}
		if attrs[1].Name != "age" || attrs[1].IsInherited {
			t.Errorf("attrs[1] = %+v, want own 'age'", attrs[1])
		}
	})

	t.Run("single level inheritance", func(t *testing.T) {
		attrs := FlattenAttributes("Dog", classes, classNames, enumNames)
		if len(attrs) != 3 {
			t.Fatalf("got %d attrs, want 3", len(attrs))
		}
		// Own first
		if attrs[0].Name != "breed" || attrs[0].IsInherited {
			t.Errorf("attrs[0] = %+v, want own 'breed'", attrs[0])
		}
		// Then inherited from Animal
		if attrs[1].Name != "name" || !attrs[1].IsInherited || attrs[1].InheritedFrom != "Animal" {
			t.Errorf("attrs[1] = %+v, want inherited 'name' from Animal", attrs[1])
		}
	})

	t.Run("deep inheritance", func(t *testing.T) {
		attrs := FlattenAttributes("Puppy", classes, classNames, enumNames)
		if len(attrs) != 4 {
			t.Fatalf("got %d attrs, want 4", len(attrs))
		}
		if attrs[0].Name != "trained" || attrs[0].IsInherited {
			t.Errorf("attrs[0] = %+v, want own 'trained'", attrs[0])
		}
		// Inherited from Dog
		if attrs[1].Name != "breed" || !attrs[1].IsInherited || attrs[1].InheritedFrom != "Dog" {
			t.Errorf("attrs[1] = %+v, want inherited 'breed' from Dog", attrs[1])
		}
		// Inherited from Animal (via Dog)
		if attrs[2].Name != "name" || !attrs[2].IsInherited || attrs[2].InheritedFrom != "Animal" {
			t.Errorf("attrs[2] = %+v, want inherited 'name' from Animal", attrs[2])
		}
	})

	t.Run("type classification", func(t *testing.T) {
		enumNames := map[string]bool{"Status": true}
		classesWithEnum := map[string]*RawClass{
			"Task": {
				Name: "Task",
				Attributes: []RawAttribute{
					{Name: "title", Type: "String"},
					{Name: "status", Type: "Status"},
					{Name: "owner", Type: "Animal"},
				},
			},
			"Animal": classes["Animal"],
		}
		cn := map[string]bool{"Task": true, "Animal": true}
		attrs := FlattenAttributes("Task", classesWithEnum, cn, enumNames)
		if attrs[0].TypeKind != "primitive" {
			t.Errorf("title TypeKind = %q, want primitive", attrs[0].TypeKind)
		}
		if attrs[1].TypeKind != "enum" {
			t.Errorf("status TypeKind = %q, want enum", attrs[1].TypeKind)
		}
		if attrs[2].TypeKind != "class" {
			t.Errorf("owner TypeKind = %q, want class", attrs[2].TypeKind)
		}
	})
}

func TestResolveAssociations(t *testing.T) {
	assocs := []RawAssociation{
		{
			ID:               "assoc1",
			ClassOneID:       "Employee",
			ClassTwoID:       "Department",
			MultiplicityOne:  "*",
			MultiplicityTwo:  "1",
			RoleOne:          "employees",
			RoleTwo:          "department",
			IsLeftNavigable:  "true",
			IsRightNavigable: "true",
		},
		{
			ID:                "assoc2",
			ClassOneID:        "Department",
			ClassTwoID:        "Company",
			MultiplicityOne:   "*",
			MultiplicityTwo:   "1",
			RoleOne:           "departments",
			RoleTwo:           "company",
			IsLeftNavigable:   "true",
			IsRightNavigable:  "true",
			IsRightComposition: "true",
		},
	}

	t.Run("class one perspective", func(t *testing.T) {
		got := ResolveAssociations("Employee", assocs)
		if len(got) != 1 {
			t.Fatalf("got %d associations, want 1", len(got))
		}
		a := got[0]
		if a.ID != "assoc1" {
			t.Errorf("ID = %q, want assoc1", a.ID)
		}
		if a.EndID != "assoc1:classOne" {
			t.Errorf("EndID = %q, want assoc1:classOne", a.EndID)
		}
		if a.SourceClassID != "Employee" {
			t.Errorf("SourceClassID = %q, want Employee", a.SourceClassID)
		}
		if a.TargetClassID != "Department" {
			t.Errorf("TargetClassID = %q, want Department", a.TargetClassID)
		}
		if a.TargetClass != "Department" {
			t.Errorf("TargetClass = %q, want Department", a.TargetClass)
		}
		if a.RoleName != "department" {
			t.Errorf("RoleName = %q, want department", a.RoleName)
		}
		if a.ReverseRoleName != "employees" {
			t.Errorf("ReverseRoleName = %q, want employees", a.ReverseRoleName)
		}
		if a.Multiplicity.Min != 1 || a.Multiplicity.Max != 1 {
			t.Errorf("Multiplicity = %+v, want {1, 1}", a.Multiplicity)
		}
		if !a.IsNavigable {
			t.Error("expected navigable")
		}
		if a.IsReflexive {
			t.Error("Employee->Department should not be reflexive")
		}
	})

	t.Run("class two perspective", func(t *testing.T) {
		got := ResolveAssociations("Department", assocs)
		if len(got) != 2 {
			t.Fatalf("got %d associations, want 2", len(got))
		}
		// Should have Employee and Company associations
		targets := map[string]CrudAssociation{}
		for _, a := range got {
			targets[a.TargetClass] = a
		}

		emp := targets["Employee"]
		if emp.ID != "assoc1" {
			t.Errorf("Employee assoc ID = %q, want assoc1", emp.ID)
		}
		if emp.EndID != "assoc1:classTwo" {
			t.Errorf("Employee assoc EndID = %q, want assoc1:classTwo", emp.EndID)
		}
		if emp.RoleName != "employees" {
			t.Errorf("Employee role = %q, want employees", emp.RoleName)
		}
		if emp.Multiplicity.Max != -1 {
			t.Errorf("Employee multiplicity max = %d, want -1", emp.Multiplicity.Max)
		}

		comp := targets["Company"]
		if !comp.IsComposition {
			t.Error("Company association should be composition")
		}
	})

	t.Run("self referencing", func(t *testing.T) {
		selfAssoc := []RawAssociation{
			{
				ID:               "self1",
				ClassOneID:       "Employee",
				ClassTwoID:       "Employee",
				MultiplicityOne:  "0..1",
				MultiplicityTwo:  "*",
				RoleOne:          "manager",
				RoleTwo:          "reports",
				IsLeftNavigable:  "true",
				IsRightNavigable: "true",
			},
		}
		got := ResolveAssociations("Employee", selfAssoc)
		if len(got) != 2 {
			t.Fatalf("self-ref: got %d associations, want 2", len(got))
		}
		for _, a := range got {
			if !a.IsReflexive {
				t.Errorf("self-ref association %q should be reflexive", a.RoleName)
			}
		}
		// Verify reverse role names are cross-linked
		roles := map[string]string{}
		for _, a := range got {
			roles[a.RoleName] = a.ReverseRoleName
		}
		if roles["reports"] != "manager" {
			t.Errorf("reports reverse = %q, want manager", roles["reports"])
		}
		if roles["manager"] != "reports" {
			t.Errorf("manager reverse = %q, want reports", roles["manager"])
		}
	})

	t.Run("unidirectional", func(t *testing.T) {
		uniAssoc := []RawAssociation{
			{
				ID:               "uni1",
				ClassOneID:       "Order",
				ClassTwoID:       "Product",
				MultiplicityOne:  "1",
				MultiplicityTwo:  "*",
				RoleOne:          "",
				RoleTwo:          "items",
				IsLeftNavigable:  "false",
				IsRightNavigable: "true",
			},
		}
		fromOrder := ResolveAssociations("Order", uniAssoc)
		if len(fromOrder) != 1 {
			t.Fatalf("got %d, want 1", len(fromOrder))
		}
		if !fromOrder[0].IsNavigable {
			t.Error("Order->Product should be navigable from Order side")
		}

		fromProduct := ResolveAssociations("Product", uniAssoc)
		if len(fromProduct) != 1 {
			t.Fatalf("got %d, want 1", len(fromProduct))
		}
		if fromProduct[0].IsNavigable {
			t.Error("Product->Order should NOT be navigable from Product side")
		}
	})
}

func TestTransformSchema(t *testing.T) {
	t.Run("empty model", func(t *testing.T) {
		schema := TransformSchema(RawModel{})
		if len(schema.Classes) != 0 {
			t.Errorf("expected 0 classes, got %d", len(schema.Classes))
		}
		if len(schema.Enums) != 0 {
			t.Errorf("expected 0 enums, got %d", len(schema.Enums))
		}
	})

	t.Run("single class with attributes", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{
					ID:   "class-person-1",
					Name: "Person",
					Attributes: []RawAttribute{
						{Name: "name", Type: "String"},
						{Name: "age", Type: "Integer"},
					},
				},
			},
		}
		schema := TransformSchema(raw)
		if len(schema.Classes) != 1 {
			t.Fatalf("expected 1 class, got %d", len(schema.Classes))
		}
		c := schema.Classes[0]
		if c.ID != "class-person-1" {
			t.Errorf("class id = %q, want class-person-1", c.ID)
		}
		if c.Name != "Person" {
			t.Errorf("class name = %q, want Person", c.Name)
		}
		if len(c.Attributes) != 2 {
			t.Errorf("expected 2 attrs, got %d", len(c.Attributes))
		}
		if c.Attributes[0].TypeKind != "primitive" {
			t.Errorf("name TypeKind = %q, want primitive", c.Attributes[0].TypeKind)
		}
	})

	t.Run("inheritance flattens attributes", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{
					Name: "Vehicle",
					Attributes: []RawAttribute{
						{Name: "make", Type: "String"},
					},
				},
				{
					Name:         "Car",
					ExtendsClass: "Vehicle",
					Attributes: []RawAttribute{
						{Name: "doors", Type: "Integer"},
					},
				},
			},
		}
		schema := TransformSchema(raw)
		if len(schema.Classes) != 2 {
			t.Fatalf("expected 2 classes, got %d", len(schema.Classes))
		}
		// Find Car
		var car *CrudClass
		for i := range schema.Classes {
			if schema.Classes[i].Name == "Car" {
				car = &schema.Classes[i]
				break
			}
		}
		if car == nil {
			t.Fatal("Car class not found")
		}
		if car.ExtendsClass != "Vehicle" {
			t.Errorf("ExtendsClass = %q, want Vehicle", car.ExtendsClass)
		}
		if len(car.Attributes) != 2 {
			t.Fatalf("Car should have 2 attrs (own + inherited), got %d", len(car.Attributes))
		}
		if car.Attributes[0].Name != "doors" || car.Attributes[0].IsInherited {
			t.Errorf("first attr should be own 'doors', got %+v", car.Attributes[0])
		}
		if car.Attributes[1].Name != "make" || !car.Attributes[1].IsInherited {
			t.Errorf("second attr should be inherited 'make', got %+v", car.Attributes[1])
		}
	})

	t.Run("abstract class marked", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{Name: "Shape", IsAbstract: FlexBool(true)},
			},
		}
		schema := TransformSchema(raw)
		if !schema.Classes[0].IsAbstract {
			t.Error("Shape should be abstract")
		}
	})

	t.Run("associations resolved", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{Name: "Student"},
				{Name: "Course"},
			},
			UmpleAssociations: []RawAssociation{
				{
					ClassOneID:       "Student",
					ClassTwoID:       "Course",
					MultiplicityOne:  "*",
					MultiplicityTwo:  "*",
					RoleOne:          "students",
					RoleTwo:          "courses",
					IsLeftNavigable:  "true",
					IsRightNavigable: "true",
				},
			},
		}
		schema := TransformSchema(raw)
		var student *CrudClass
		for i := range schema.Classes {
			if schema.Classes[i].Name == "Student" {
				student = &schema.Classes[i]
				break
			}
		}
		if student == nil {
			t.Fatal("Student not found")
		}
		if len(student.Associations) != 1 {
			t.Fatalf("expected 1 association, got %d", len(student.Associations))
		}
		if student.Associations[0].TargetClass != "Course" {
			t.Errorf("target = %q, want Course", student.Associations[0].TargetClass)
		}
	})

	t.Run("global enums extracted", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{
					Name: "Task",
					Attributes: []RawAttribute{
						{Name: "priority", Type: "Priority"},
					},
				},
			},
			GlobalEnums: []map[string][]string{
				{"Priority": {"Low", "Medium", "High"}},
			},
		}
		schema := TransformSchema(raw)
		if len(schema.Enums) != 1 {
			t.Fatalf("expected 1 enum, got %d", len(schema.Enums))
		}
		if schema.Enums[0].Name != "Priority" {
			t.Errorf("enum name = %q, want Priority", schema.Enums[0].Name)
		}
		if len(schema.Enums[0].Values) != 3 {
			t.Errorf("expected 3 values, got %d", len(schema.Enums[0].Values))
		}
		// The attribute should be classified as enum
		if schema.Classes[0].Attributes[0].TypeKind != "enum" {
			t.Errorf("priority TypeKind = %q, want enum", schema.Classes[0].Attributes[0].TypeKind)
		}
	})

	t.Run("class-local enums extracted", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{
					Name: "Light",
					Attributes: []RawAttribute{
						{Name: "color", Type: "Color"},
					},
					Enums: []map[string][]string{
						{"Color": {"Red", "Green", "Blue"}},
					},
				},
			},
		}
		schema := TransformSchema(raw)
		if len(schema.Enums) != 1 {
			t.Fatalf("expected 1 enum, got %d", len(schema.Enums))
		}
		if schema.Enums[0].Name != "Color" {
			t.Errorf("enum name = %q, want Color", schema.Enums[0].Name)
		}
		if schema.Classes[0].Attributes[0].TypeKind != "enum" {
			t.Errorf("color TypeKind = %q, want enum", schema.Classes[0].Attributes[0].TypeKind)
		}
	})

	t.Run("class-typed attribute classified", func(t *testing.T) {
		raw := RawModel{
			UmpleClasses: []RawClass{
				{Name: "Address"},
				{
					Name: "Person",
					Attributes: []RawAttribute{
						{Name: "home", Type: "Address"},
					},
				},
			},
		}
		schema := TransformSchema(raw)
		var person *CrudClass
		for i := range schema.Classes {
			if schema.Classes[i].Name == "Person" {
				person = &schema.Classes[i]
				break
			}
		}
		if person == nil {
			t.Fatal("Person not found")
		}
		if person.Attributes[0].TypeKind != "class" {
			t.Errorf("home TypeKind = %q, want class", person.Attributes[0].TypeKind)
		}
	})
}
