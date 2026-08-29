export interface RenderDestinationSelection {
  token: string;
  directory: string;
}

export async function startRenderWithDestination<TJob>(input: {
  chooseDestination: () => Promise<RenderDestinationSelection | null>;
  preflight: () => Promise<{ ready: boolean }>;
  queue: () => Promise<TJob>;
}): Promise<{ destination: RenderDestinationSelection; job: TJob } | null> {
  const destination = await input.chooseDestination();
  if (!destination) return null;

  const preflight = await input.preflight();
  if (!preflight.ready) return null;

  const job = await input.queue();
  return { destination, job };
}
