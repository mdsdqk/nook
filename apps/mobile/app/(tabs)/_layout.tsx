import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarLabel: "Dashboard" }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ title: "Accounts", tabBarLabel: "Accounts" }}
      />
      <Tabs.Screen
        name="add"
        options={{ title: "Add", tabBarLabel: "Add" }}
      />
    </Tabs>
  );
}
