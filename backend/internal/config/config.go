package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port           int
	UmpleSyncJar   string
	UmplePort      int
	ModelStorePath string
	ExamplePath    string
	ExecutionURL   string
	AllowedOrigins []string
}

func Load() *Config {
	return &Config{
		Port:           getEnvInt("PORT", 3001),
		UmpleSyncJar:   getEnv("UMPLE_SYNC_JAR", "/jars/umplesync.jar"),
		UmplePort:      getEnvInt("UMPLE_PORT", 5555),
		ModelStorePath: getEnv("MODEL_STORE_PATH", "/data/models"),
		ExamplePath:    getEnv("EXAMPLE_PATH", "/examples"),
		ExecutionURL:   getEnv("EXECUTION_URL", "http://code-exec:4400"),
		AllowedOrigins: getOrigins("ALLOWED_ORIGINS", []string{"http://localhost:3100"}),
	}
}

func getOrigins(key string, fallback []string) []string {
	if v := os.Getenv(key); v != "" {
		parts := strings.Split(v, ",")
		origins := make([]string, 0, len(parts))
		for _, p := range parts {
			if s := strings.TrimSpace(p); s != "" {
				origins = append(origins, s)
			}
		}
		return origins
	}
	return fallback
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
