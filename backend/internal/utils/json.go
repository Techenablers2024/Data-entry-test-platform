package utils

import "encoding/json"

// MustJSONMarshal marshals v to JSON bytes, panicking only on programmer error (non-serialisable types).
func MustJSONMarshal(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic("MustJSONMarshal: " + err.Error())
	}
	return b
}
