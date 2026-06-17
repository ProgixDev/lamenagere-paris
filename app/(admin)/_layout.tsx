import { Redirect } from "expo-router";

// Mobile admin screens are deprecated: administration is handled by the
// separate web admin. Any access to the (admin) route group (e.g. via a
// deep link) is redirected back into the app so these stub screens are not
// reachable dead ends.
export default function AdminLayout() {
  return <Redirect href="/(tabs)" />;
}
