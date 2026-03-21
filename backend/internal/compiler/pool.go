package compiler

import (
	"fmt"
	"log"
	"net"
	"os/exec"
	"sync"
	"time"
)

// Pool manages a long-running umplesync.jar server process and provides
// TCP socket connections to it. If the JVM crashes, the pool auto-restarts it.
type Pool struct {
	jarPath string
	port    int

	mu      sync.Mutex
	process *exec.Cmd
	alive   bool

	// Per-model mutex prevents concurrent writes to the same model directory.
	modelMu sync.Map // map[string]*sync.Mutex
}

func NewPool(jarPath string, port int) (*Pool, error) {
	p := &Pool{
		jarPath: jarPath,
		port:    port,
	}
	if err := p.startServer(); err != nil {
		log.Printf("warning: failed to start umplesync server: %v (will retry on first request)", err)
	}
	return p, nil
}

// Execute sends a command to the umplesync server and returns the result.
// It acquires a per-model lock to prevent concurrent writes.
func (p *Pool) Execute(req CompileRequest) (*CompileResult, error) {
	// Acquire per-model lock
	mu := p.getModelMutex(req.WorkDir)
	mu.Lock()
	defer mu.Unlock()

	// Ensure server is running
	if err := p.ensureRunning(); err != nil {
		return nil, fmt.Errorf("compiler not available: %w", err)
	}

	// Connect
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", p.port), 5*time.Second)
	if err != nil {
		// Server might have died — try restart once
		log.Printf("connection failed, restarting server: %v", err)
		if restartErr := p.startServer(); restartErr != nil {
			return nil, fmt.Errorf("restart failed: %w", restartErr)
		}
		time.Sleep(2 * time.Second)
		conn, err = net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", p.port), 5*time.Second)
		if err != nil {
			return nil, fmt.Errorf("connect after restart failed: %w", err)
		}
	}
	defer conn.Close()

	return sendCommand(conn, req.Command)
}

func (p *Pool) startServer() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Kill existing if any
	if p.process != nil && p.process.Process != nil {
		p.process.Process.Kill()
		p.process.Wait()
	}

	cmd := exec.Command("java", "-cp", p.jarPath, "cruise.umple.PlaygroundMain", "-server", fmt.Sprintf("%d", p.port))
	if err := cmd.Start(); err != nil {
		p.alive = false
		return fmt.Errorf("failed to start umplesync: %w", err)
	}

	p.process = cmd
	p.alive = true

	// Monitor process in background
	go func() {
		err := cmd.Wait()
		p.mu.Lock()
		p.alive = false
		p.mu.Unlock()
		if err != nil {
			log.Printf("umplesync process exited: %v", err)
		}
	}()

	// Wait for server to be ready
	for i := 0; i < 20; i++ {
		time.Sleep(250 * time.Millisecond)
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", p.port), time.Second)
		if err == nil {
			conn.Close()
			log.Printf("umplesync server ready on port %d", p.port)
			return nil
		}
	}

	return fmt.Errorf("umplesync server did not become ready within 5s")
}

func (p *Pool) ensureRunning() error {
	p.mu.Lock()
	alive := p.alive
	p.mu.Unlock()

	if alive {
		return nil
	}
	return p.startServer()
}

func (p *Pool) getModelMutex(workDir string) *sync.Mutex {
	val, _ := p.modelMu.LoadOrStore(workDir, &sync.Mutex{})
	return val.(*sync.Mutex)
}

func (p *Pool) Shutdown() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.process != nil && p.process.Process != nil {
		p.process.Process.Kill()
		p.process.Wait()
	}
	p.alive = false
}
