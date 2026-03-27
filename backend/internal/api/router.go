package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/umple/umpleonline/backend/internal/api/handlers"
	"github.com/umple/umpleonline/backend/internal/compiler"
	"github.com/umple/umpleonline/backend/internal/config"
	"github.com/umple/umpleonline/backend/internal/execution"
	"github.com/umple/umpleonline/backend/internal/model"
)

func NewRouter(cfg *config.Config, pool *compiler.Pool, store *model.Store) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", "X-Api-Key", "X-Goog-Api-Key", "Anthropic-Version"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Existing handlers
	compileH := handlers.NewCompileHandler(pool, store)
	exampleH := handlers.NewExampleHandler(cfg.ExamplePath)
	healthH := handlers.NewHealthHandler(cfg)

	// New handlers
	generateH := handlers.NewGenerateHandler(pool, store, cfg)
	syncH := handlers.NewSyncHandler(pool, store)
	diagramH := handlers.NewDiagramHandler(pool, store)
	exportH := handlers.NewExportHandler(pool, store)
	generatedAssetH := handlers.NewGeneratedAssetHandler(store)
	execProxy := execution.NewProxy(cfg.ExecutionURL)
	executeH := handlers.NewExecuteHandler(pool, store, execProxy)
	taskH := handlers.NewTaskHandler(store)
	aiProxyH := handlers.NewAIProxyHandler()

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthH.Health)

		// Compile & generate
		r.Post("/compile", compileH.Compile)
		r.Post("/generate", generateH.Generate)
		r.Post("/sync", syncH.Sync)
		r.Post("/diagram", diagramH.Generate)
		r.Post("/export", exportH.Export)
		r.Post("/execute", executeH.Execute)
		r.Get("/generated/{modelId}/*", generatedAssetH.Serve)

		// Examples
		r.Get("/examples", exampleH.List)
		r.Get("/examples/{name}", exampleH.Get)

		// Tasks
		r.Post("/tasks", taskH.Create)
		r.Get("/tasks/{id}", taskH.Get)
		r.Post("/tasks/{id}/submit", taskH.Submit)

		// AI provider proxy (browser → backend → provider)
		r.Route("/ai", aiProxyH.Routes())
	})

	return r
}
