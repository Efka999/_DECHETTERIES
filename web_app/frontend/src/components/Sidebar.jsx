import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { Building2, LayoutDashboard, MapPinned } from "lucide-react";

const CA_DECHETTERIES = [
  { id: "Pépinière", label: "La Pépinière" },
  { id: "St Germain", label: "St Germain" },
  { id: "Sanssac", label: "Sanssac" },
  { id: "Polignac", label: "Polignac" },
];

const HORS_AGGLO_DECHETTERIES = [
  { id: "Bas-en-basset", label: "Bas en Basset" },
  { id: "Yssingeaux", label: "Yssingeaux" },
  { id: "Monistrol", label: "Monistrol" },
];

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isAvailable = (entry, available) => {
  if (!available || available.length === 0) return true;
  const normalized = normalizeName(entry.id);
  return available.some((name) => normalizeName(name) === normalized);
};

const SidebarItem = ({ id, label, icon: Icon, isActive, onSelect }) => (
  <SidebarMenuItem>
    <SidebarMenuButton isActive={isActive} onClick={() => onSelect(id)}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

const SidebarGroupSection = ({ title, items, icon, selectedKey, onSelect, available }) => (
  <SidebarGroup>
    <SidebarGroupLabel>{title}</SidebarGroupLabel>
    <SidebarMenu>
      {items
        .filter((entry) => isAvailable(entry, available))
        .map((entry) => (
          <SidebarItem
            key={entry.id}
            id={entry.id}
            label={entry.label}
            icon={icon}
            isActive={selectedKey === entry.id}
            onSelect={onSelect}
          />
        ))}
    </SidebarMenu>
  </SidebarGroup>
);

const SidebarNavigation = ({ selectedKey, onSelect, availableDechetteries }) => (
  <Sidebar>
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarItem
            id="global"
            label="Vue globale"
            icon={LayoutDashboard}
            isActive={selectedKey === "global"}
            onSelect={onSelect}
          />
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroupSection
        title="CA du Puy en Velay"
        items={CA_DECHETTERIES}
        icon={Building2}
        selectedKey={selectedKey}
        onSelect={onSelect}
        available={availableDechetteries}
      />
      <SidebarGroupSection
        title="Hors agglo"
        items={HORS_AGGLO_DECHETTERIES}
        icon={MapPinned}
        selectedKey={selectedKey}
        onSelect={onSelect}
        available={availableDechetteries}
      />
    </SidebarContent>
  </Sidebar>
);

export default SidebarNavigation;
