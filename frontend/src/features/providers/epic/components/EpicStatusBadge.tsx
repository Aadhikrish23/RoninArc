import ProviderStatusBadge from "../../components/ProviderStatusBadge";

interface Props {
  connected: boolean;
}

export default function EpicStatusBadge({ connected }: Props) {
  return <ProviderStatusBadge connected={connected} />;
}
