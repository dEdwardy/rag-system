import { Alert, Center, Loader, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  description?: string;
  tone?: "empty" | "error" | "loading";
  action?: ReactNode;
};

export function StatePanel({ title, description, tone = "empty", action }: StatePanelProps) {
  if (tone === "loading") {
    return (
      <Center mih={160}>
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
      </Center>
    );
  }

  if (tone === "error") {
    return (
      <Alert color="red" variant="light">
        <Text fw={600}>{title}</Text>
        {description ? (
          <Text mt={4} size="sm">
            {description}
          </Text>
        ) : null}
        {action}
      </Alert>
    );
  }

  return (
    <Paper p="xl" radius="md" withBorder>
      <Stack align="center" gap="xs">
        <Text fw={600}>{title}</Text>
        {description ? (
          <Text c="dimmed" size="sm" ta="center">
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Paper>
  );
}
