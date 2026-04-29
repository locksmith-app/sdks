package locksmith // import "github.com/uselocksmith/sdk-go"

import "fmt"

// LocksmithError is returned when the API responds with a non-success status.
type LocksmithError struct {
	Code    string
	Message string
	Status  int
}

func (e *LocksmithError) Error() string {
	return fmt.Sprintf("locksmith: %s (%d): %s", e.Code, e.Status, e.Message)
}

func newLocksmithError(code, msg string, status int) *LocksmithError {
	return &LocksmithError{Code: code, Message: msg, Status: status}
}
