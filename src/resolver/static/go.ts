import { createEcosystemProvider, type KnowledgeTable } from './_table.js'

const TABLE: KnowledgeTable = {
  // ---------- Frameworks ----------
  'github.com/gin-gonic/gin': { displayName: 'Gin', category: 'framework', variant: 'Web framework', summary: 'Fast HTTP web framework for Go' },
  'github.com/labstack/echo': { displayName: 'Echo', category: 'framework', variant: 'Web framework', summary: 'High-performance Go web framework' },
  'github.com/gofiber/fiber': { displayName: 'Fiber', category: 'framework', variant: 'Web framework', summary: 'Express-inspired Go web framework' },
  'github.com/gorilla/mux': { displayName: 'Gorilla Mux', category: 'framework', variant: 'HTTP router', summary: 'Powerful URL router for Go' },
  'github.com/go-chi/chi': { displayName: 'Chi', category: 'framework', variant: 'HTTP router', summary: 'Lightweight Go HTTP router' },
  'google.golang.org/grpc': { displayName: 'gRPC', category: 'framework', variant: 'RPC framework', summary: 'High-performance RPC framework' },
  'github.com/grpc-ecosystem/grpc-gateway': { displayName: 'gRPC-Gateway', category: 'framework', summary: 'gRPC to REST proxy' },
  'github.com/go-kratos/kratos': { displayName: 'Kratos', category: 'framework', variant: 'Microservices', summary: 'Go microservices framework' },
  'go.uber.org/fx': { displayName: 'Uber Fx', category: 'framework', variant: 'DI framework', summary: 'Dependency injection for Go' },
  'github.com/google/wire': { displayName: 'Wire', category: 'framework', variant: 'DI', summary: 'Compile-time DI for Go' },
  'github.com/spf13/cobra': { displayName: 'Cobra', category: 'framework', variant: 'CLI framework', summary: 'Go CLI framework' },
  'github.com/urfave/cli': { displayName: 'urfave/cli', category: 'framework', variant: 'CLI framework', summary: 'Go CLI framework' },
  'github.com/charmbracelet/bubbletea': { displayName: 'Bubble Tea', category: 'framework', variant: 'TUI framework', summary: 'Terminal UI framework for Go' },

  // ---------- Testing ----------
  'github.com/stretchr/testify': {
    displayName: 'testify', category: 'testing',
    summary: 'Go testing toolkit with assertions and mocks',
    conventions: ['Use `assert` for non-fatal checks, `require` for fatal.', 'Test files: `*_test.go`.'],
  },
  'github.com/onsi/ginkgo': { displayName: 'Ginkgo', category: 'testing', summary: 'BDD testing framework for Go' },
  'github.com/onsi/gomega': { displayName: 'Gomega', category: 'testing', summary: 'Matcher library for Ginkgo' },

  // ---------- Databases ----------
  'gorm.io/gorm': { displayName: 'GORM', category: 'database', summary: 'ORM for Go' },
  'github.com/jmoiron/sqlx': { displayName: 'sqlx', category: 'database', summary: 'Extensions to Go database/sql' },
  'entgo.io/ent': { displayName: 'Ent', category: 'database', summary: 'Entity framework for Go' },
  'github.com/go-redis/redis': { displayName: 'Redis', category: 'database', summary: 'Redis client for Go' },
  'go.mongodb.org/mongo-driver': { displayName: 'MongoDB', category: 'database', summary: 'MongoDB driver for Go' },
  'github.com/jackc/pgx': { displayName: 'PostgreSQL (pgx)', category: 'database', summary: 'PostgreSQL driver for Go' },

  // ---------- Dev tools ----------
  'github.com/golangci/golangci-lint': { displayName: 'golangci-lint', category: 'devtool', summary: 'Go linter aggregator', commands: ['golangci-lint run'] },
  'golang.org/x/tools': { displayName: 'Go Tools', category: 'devtool', summary: 'Go supplementary tools' },
  'github.com/air-verse/air': { displayName: 'Air', category: 'devtool', summary: 'Live reload for Go apps', commands: ['air'] },
}

// Go modules are matched by prefix (e.g. `github.com/gin-gonic/gin/foo`).
export const goKnowledge = createEcosystemProvider('static:go', 'go', TABLE, { matcher: 'prefix' })
