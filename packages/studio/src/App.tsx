import { StudioProvider } from "./context/StudioContext";
import { StudioLayout } from "./components/studio/StudioLayout";

export function App() {
  return (
    <StudioProvider>
      <StudioLayout />
    </StudioProvider>
  );
}
