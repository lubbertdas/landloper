// App entry. The background location task must be registered before the
// router renders anything, so the OS can deliver fixes to a headless start.
import "./src/runtime/locationTask";
import "expo-router/entry";
