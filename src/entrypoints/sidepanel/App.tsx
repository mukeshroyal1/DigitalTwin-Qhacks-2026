import { SettingsProvider } from '../../ui/context/SettingsContext';
import { SidePanel } from '../../ui/pages/SidePanel';

export default function App() {
  return (
    <SettingsProvider>
      <SidePanel />
    </SettingsProvider>
  );
}
