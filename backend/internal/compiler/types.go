package compiler

// CompileRequest is sent from API handlers to the compiler pool.
type CompileRequest struct {
	// Command is the raw command line to send to umplesync.jar via TCP.
	// e.g. "-generate Json /data/models/abc123/model.ump"
	Command string

	// WorkDir is the model directory containing the .ump files.
	WorkDir string
}

// CompileResult holds the response from the compiler.
type CompileResult struct {
	// Output is the stdout content from the compiler.
	Output string

	// Errors is the content extracted from ERROR!!...!!ERROR framing.
	Errors string
}
