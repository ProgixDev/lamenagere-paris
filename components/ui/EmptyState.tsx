import React from "react";
import { View, Text } from "react-native";
import Icon from "./Icon";
import { COLORS } from "../../lib/constants";
import Button from "./Button";

interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export default function EmptyState({
  icon,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Icon
        name={icon as any}
        size={48}
        color={COLORS.surfaceDim}
      />
      <Text
        className="text-lg mt-4 mb-2 text-center"
        style={{
          color: COLORS.onSurface,
          fontFamily: "Manrope_700Bold",
        }}
      >
        {title}
      </Text>
      {message && (
        <Text
          className="text-sm text-center mb-6"
          style={{ color: COLORS.onSurfaceVariant }}
        >
          {message}
        </Text>
      )}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          size="md"
          fullWidth={false}
        />
      )}
    </View>
  );
}
