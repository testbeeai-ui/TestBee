import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";
import { colors } from "@/shared/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: "house.fill", android: "home", web: "home" }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: "book.fill", android: "menu_book", web: "menu_book" }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="gyan"
        options={{
          title: "Gyan++",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "questionmark.circle.fill", android: "help", web: "help" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: "Earn",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "indianrupeesign.circle.fill", android: "paid", web: "paid" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "person.crop.circle.fill", android: "person", web: "person" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
