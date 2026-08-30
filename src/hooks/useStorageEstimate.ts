import { useEffect, useState } from "react";

interface StorageEstimate {
  usage: number;
  quota: number;
  available: number;
}

export function useStorageEstimate(): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    navigator.storage.estimate().then(({ usage, quota }) => {
      if (quota) {
        setEstimate({
          usage: usage || 0,
          quota,
          available: quota - (usage || 0)
        });
      }
    });
  }, []);

  return estimate;
}
