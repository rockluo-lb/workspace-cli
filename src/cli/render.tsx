import React from "react";
import { Box, Newline, Text, renderToString } from "ink";

type Primitive = string | number | boolean | null | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleFromKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function primitiveToString(value: Primitive): string {
  if (value === undefined) {
    return "-";
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Box marginTop={1}>
      <Text color="gray">{JSON.stringify(value, null, 2)}</Text>
    </Box>
  );
}

function PrimitiveRow({ label, value }: { label: string; value: Primitive }) {
  return (
    <Box>
      <Box width={18}>
        <Text color="cyan">{label}</Text>
      </Box>
      <Text>{primitiveToString(value)}</Text>
    </Box>
  );
}

function ArraySection({ label, items }: { label: string; items: unknown[] }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="yellow">
        {label}
      </Text>
      {items.length === 0 ? (
        <Text color="gray">- none</Text>
      ) : (
        items.map((item, index) => (
          <Box key={`${label}-${index}`} paddingLeft={2}>
            {isPlainObject(item) || Array.isArray(item) ? (
              <Box flexDirection="column">
                <Text color="green">- item {index + 1}</Text>
                <Box paddingLeft={2}>
                  <DataNode value={item} />
                </Box>
              </Box>
            ) : (
              <Text>
                <Text color="green">- </Text>
                {primitiveToString(item as Primitive)}
              </Text>
            )}
          </Box>
        ))
      )}
    </Box>
  );
}

function ObjectSection({ label, value }: { label: string; value: Record<string, unknown> }) {
  const primitiveEntries = Object.entries(value).filter(([, entry]) => !isPlainObject(entry) && !Array.isArray(entry));
  const nestedEntries = Object.entries(value).filter(([, entry]) => isPlainObject(entry) || Array.isArray(entry));

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="yellow">
        {label}
      </Text>
      {primitiveEntries.length === 0 && nestedEntries.length === 0 ? <Text color="gray">- empty</Text> : null}
      {primitiveEntries.map(([key, entry]) => (
        <PrimitiveRow key={key} label={titleFromKey(key)} value={entry as Primitive} />
      ))}
      {nestedEntries.map(([key, entry]) => (
        <Box key={key} paddingLeft={2}>
          <DataNode label={titleFromKey(key)} value={entry} />
        </Box>
      ))}
    </Box>
  );
}

function DataNode({ label, value }: { label?: string; value: unknown }) {
  if (Array.isArray(value)) {
    return <ArraySection label={label ?? "Items"} items={value} />;
  }

  if (isPlainObject(value)) {
    return <ObjectSection label={label ?? "Details"} value={value} />;
  }

  if (label) {
    return <PrimitiveRow label={label} value={value as Primitive} />;
  }

  return <JsonBlock value={value} />;
}

function ScreenFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {title}
      </Text>
      <Text color="gray">{"=".repeat(Math.max(title.length, 12))}</Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}

export function renderValueScreen(title: string, value: unknown): string {
  return renderToString(
    <ScreenFrame title={title}>
      <DataNode value={value} />
      <Text>
        <Newline />
      </Text>
    </ScreenFrame>,
  );
}

export function renderErrorScreen(code: string, message: string, details?: string): string {
  return renderToString(
    <ScreenFrame title="Vibe Flow Error">
      <PrimitiveRow label="Code" value={code} />
      <PrimitiveRow label="Message" value={message} />
      {details ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            Details
          </Text>
          <Text color="gray">{details}</Text>
        </Box>
      ) : null}
      <Text>
        <Newline />
      </Text>
    </ScreenFrame>,
  );
}
