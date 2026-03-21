package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port           int
	UmpleJar       string
	UmplePort      int
	ModelStorePath string
	ExamplePath    string
	ExecutionURL   string
	AllowedOrigins []string
}

func Load() *Config {
	return &Config{
		Port:           getEnvInt("PORT", 3001),
		UmpleJar:       getEnv("UMPLE_JAR", "/jars/umple.jar"),
		UmplePort:      getEnvInt("UMPLE_PORT", 5555),
		ModelStorePath: getEnv("MODEL_STORE_PATH", "/data/models"),
		ExamplePath:    getEnv("EXAMPLE_PATH", "/examples"),
		ExecutionURL:   getEnv("EXECUTION_URL", "http://code-exec:4400"),
		AllowedOrigins: []string{"http://localhost:3100", "https://umple-next.elwin.cc"},
	}
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
