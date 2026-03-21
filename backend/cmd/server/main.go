package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/umple/umple-next/backend/internal/api"
	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/config"
	"github.com/umple/umple-next/backend/internal/model"
)

func main() {
	cfg := config.Load()

	store, err := model.NewStore(cfg.ModelStorePath)
	if err != nil {
		log.Fatalf("failed to initialize model store: %v", err)
	}

	pool, err := compiler.NewPool(cfg.UmpleJar, cfg.UmplePort)
	if err != nil {
		log.Fatalf("failed to initialize compiler pool: %v", err)
	}
	defer pool.Shutdown()

	go store.CleanupLoop(30 * time.Minute)

	router := api.NewRouter(cfg, pool, store)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("server starting on :%d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}
}
