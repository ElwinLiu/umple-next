package generate

import (
	"strings"
	"testing"
)

func TestSanitizeJavaContentForJavadocRemovesSkipDirectives(t *testing.T) {
	input := strings.Join([]string{
		"/**",
		" * @@@skipcppcompile - Contains Java code",
		" * Positioning",
		" */",
		"public class Shape2D {",
		"  public UmpleSourceData Shape2D_main(){ return new UmpleSourceData().setFileNames(\".generate-java.ump\");}",
		"}",
	}, "\n")

	got := sanitizeJavaContentForJavadoc(input)

	if strings.Contains(got, "@@@skipcppcompile") {
		t.Fatalf("sanitized content should remove skip directives:\n%s", got)
	}
	if strings.Contains(got, ".generate-java.ump") {
		t.Fatalf("sanitized content should rename wrapper source file:\n%s", got)
	}
	if !strings.Contains(got, "Positioning") || !strings.Contains(got, "model.ump") {
		t.Fatalf("sanitized content removed too much:\n%s", got)
	}
}

func TestSummarizeJavadocOutputDropsNoise(t *testing.T) {
	input := strings.Join([]string{
		"warning: The -footer option is no longer supported and will be ignored.",
		"  It may be removed in a future release.",
		"Loading source file /tmp/Example.java...",
		"Constructing Javadoc information...",
		"Building index for all the packages and classes...",
		"Standard Doclet version 17.0.18+8-alpine-r0",
		"/tmp/Example.java:8: warning: no comment",
		"public class Example",
		"       ^",
		"/tmp/Example.java:10: error: bad tag",
		"12 errors",
		"48 warnings",
	}, "\n")

	got := summarizeJavadocOutput(input)

	if strings.Contains(got, "-footer option") || strings.Contains(got, "Loading source file") || strings.Contains(got, "warning: no comment") {
		t.Fatalf("summary should remove noisy diagnostics:\n%s", got)
	}
	if !strings.Contains(got, "error: bad tag") || !strings.Contains(got, "12 errors") {
		t.Fatalf("summary should retain actionable diagnostics:\n%s", got)
	}
}
