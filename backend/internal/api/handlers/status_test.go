package handlers

import "testing"

func TestBuildStatusUsesImageBuildEnvironment(t *testing.T) {
	clearBuildStatusEnv(t)

	t.Setenv("SOURCE_COMMIT", "e3cdcad2cf7de3b9e510efc58856086406004718")
	t.Setenv("SOURCE_REF", "refs/heads/master")
	t.Setenv("SOURCE_REF_NAME", "master")
	t.Setenv("SOURCE_REF_TYPE", "branch")
	t.Setenv("BUILD_TIME", "2026-04-23T20:13:17Z")
	t.Setenv("BACKEND_IMAGE_REF", "ghcr.io/umple/umpleonline/backend:sha-e3cdcad2cf7de3b9e510efc58856086406004718")

	status := buildStatus()

	if status["sourceCommit"] != "e3cdcad2cf7de3b9e510efc58856086406004718" {
		t.Fatalf("sourceCommit = %q, want image source commit", status["sourceCommit"])
	}
	if status["sourceRef"] != "refs/heads/master" {
		t.Fatalf("sourceRef = %q, want source ref", status["sourceRef"])
	}
	if status["sourceRefName"] != "master" {
		t.Fatalf("sourceRefName = %q, want source ref name", status["sourceRefName"])
	}
	if status["sourceRefType"] != "branch" {
		t.Fatalf("sourceRefType = %q, want source ref type", status["sourceRefType"])
	}
	if status["builtAt"] != "2026-04-23T20:13:17Z" {
		t.Fatalf("builtAt = %q, want build timestamp", status["builtAt"])
	}
	if status["backendImage"] != "ghcr.io/umple/umpleonline/backend:sha-e3cdcad2cf7de3b9e510efc58856086406004718" {
		t.Fatalf("backendImage = %q, want backend image", status["backendImage"])
	}
}

func TestBuildStatusFallsBackToImageAndRefMetadata(t *testing.T) {
	clearBuildStatusEnv(t)

	t.Setenv("BACKEND_IMAGE_REF", "ghcr.io/umple/umpleonline/backend:sha-abcdef123456")
	t.Setenv("GITHUB_REF", "refs/tags/v0.0.9")
	t.Setenv("BUILD_TIME", "2026-04-23T20:13:17Z")

	status := buildStatus()

	if status["sourceCommit"] != "abcdef123456" {
		t.Fatalf("sourceCommit = %q, want commit parsed from image tag", status["sourceCommit"])
	}
	if status["sourceRefName"] != "v0.0.9" {
		t.Fatalf("sourceRefName = %q, want ref name parsed from source ref", status["sourceRefName"])
	}
	if status["sourceRefType"] != "tag" {
		t.Fatalf("sourceRefType = %q, want ref type parsed from source ref", status["sourceRefType"])
	}
}

func TestReleaseStatusUsesDeploymentEnvironment(t *testing.T) {
	clearBuildStatusEnv(t)

	t.Setenv("RELEASE_TAG", "v0.0.8")
	t.Setenv("DEPLOYED_AT", "2026-04-23T22:30:00Z")
	t.Setenv("DEPLOYED_SOURCE_COMMIT", "e3cdcad2cf7de3b9e510efc58856086406004718")
	t.Setenv("DEPLOYED_SOURCE_REF", "refs/tags/v0.0.8")
	t.Setenv("BACKEND_IMAGE_REF", "ghcr.io/umple/umpleonline/backend:sha-e3cdcad2cf7de3b9e510efc58856086406004718")

	status := releaseStatus()

	if status["releaseTag"] != "v0.0.8" {
		t.Fatalf("releaseTag = %q, want release tag", status["releaseTag"])
	}
	if status["deployedAt"] != "2026-04-23T22:30:00Z" {
		t.Fatalf("deployedAt = %q, want deploy timestamp", status["deployedAt"])
	}
	if status["sourceCommit"] != "e3cdcad2cf7de3b9e510efc58856086406004718" {
		t.Fatalf("sourceCommit = %q, want deployed source commit", status["sourceCommit"])
	}
	if status["sourceRef"] != "refs/tags/v0.0.8" {
		t.Fatalf("sourceRef = %q, want deployed source ref", status["sourceRef"])
	}
	if status["backendImage"] != "ghcr.io/umple/umpleonline/backend:sha-e3cdcad2cf7de3b9e510efc58856086406004718" {
		t.Fatalf("backendImage = %q, want backend image", status["backendImage"])
	}
}

func clearBuildStatusEnv(t *testing.T) {
	t.Helper()

	for _, key := range []string{
		"GIT_COMMIT",
		"GIT_BRANCH",
		"GITHUB_SHA",
		"GITHUB_REF",
		"GITHUB_REF_NAME",
		"BUILD_TIME",
		"SOURCE_COMMIT",
		"SOURCE_REF",
		"SOURCE_REF_NAME",
		"SOURCE_REF_TYPE",
		"DEPLOYED_AT",
		"DEPLOYED_SOURCE_COMMIT",
		"DEPLOYED_SOURCE_REF",
		"RELEASE_TAG",
		"IMAGE_TAG",
		"BACKEND_IMAGE_REF",
	} {
		t.Setenv(key, "")
	}
}
