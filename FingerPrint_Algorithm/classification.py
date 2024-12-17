import math
import tkinter as tk
from tkinter import ttk
from itertools import chain
import json
from dataclasses import dataclass

# --- Load Glossary ---
def load_glossary_data(file_path):
    try:
        with open(file_path, "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {file_path}: {e}")
        return {}

# --- Parameters ---
@dataclass
class CostParams:
    lambda_breadth: float = 1.5
    mu_imbalance: float = 0.5
    nu_depth: float = 0.3
    omega_coherence: float = 3.0
    relevance_threshold: float = 0.6

params = CostParams()

# --- Utility Functions ---
def cached_overlap(parent, child):
    """ Cache overlap for reuse in multiple calculations. """
    parent_set, child_set = set(parent), set(child)
    overlap = len(parent_set & child_set)
    return overlap, len(child_set), max(len(parent_set), len(child_set))

def relevance_score(overlap, child_size):
    return overlap / child_size if child_size else 0.0

def breadth_penalty(group_ratio):
    return params.lambda_breadth * max(group_ratio, 1)

def coherence_penalty(overlap, max_size):
    coherence = overlap / max_size if max_size > 0 else 0.0
    return params.omega_coherence * max(coherence, 1e-5)

def depth_penalty(depth):
    return params.nu_depth * depth

def imbalance_penalty(subgroup_count):
    if subgroup_count <= 1:
        return 0.0
    ideal_count = math.log2(subgroup_count + 1)
    return params.mu_imbalance * abs(subgroup_count - ideal_count)

# --- Cost Function ---
def calculate_cost(parent_group, child_group, depth, subgroup_count):
    overlap, child_size, max_size = cached_overlap(parent_group, child_group)
    relevance = relevance_score(overlap, child_size)
    if relevance <= params.relevance_threshold:
        return math.inf
    breadth = breadth_penalty(len(parent_group) / len(child_group))
    coherence = coherence_penalty(overlap, max_size)
    #depth_cost = depth_penalty(depth)
    #imbalance = imbalance_penalty(subgroup_count)
    return (1 / relevance) + breadth + coherence #+ depth_cost + imbalance



import math

def build_hierarchy(groups):
    hierarchy, assigned_children = {}, set()
    depth_tracker = {group: 0 for group in groups}

    # Sort the groups beforehand
    sorted_groups = sorted(groups.items())

    for i, (child, child_members) in enumerate(sorted_groups):
        min_cost, best_parent = math.inf, None

        # Iterate over subgroups using i+1 to ensure we're considering only parents after the current child
        for j, (parent, parent_members) in enumerate(sorted_groups[i + 1:]):
            if parent == child:
                continue
            # Calculate cost (you'll need to define calculate_cost)
            cost = calculate_cost(parent_members, child_members, depth_tracker[parent], 
                                  len(hierarchy.get(parent, {}).get("subgroups", [])))
            if cost != math.inf:
                print(child,parent,cost)
            if cost < min_cost:
                min_cost, best_parent = cost, parent

        # Assign the child to the best parent
        if best_parent:
            hierarchy.setdefault(best_parent, {"members": groups[best_parent], "subgroups": []})
            hierarchy[best_parent]["subgroups"].append(child)
            assigned_children.add(child)
            depth_tracker[child] = depth_tracker[best_parent] + 1

    # Add any unassigned groups to the hierarchy with empty subgroups
    for group, members in groups.items():
        if group not in assigned_children:
            hierarchy.setdefault(group, {"members": members, "subgroups": []})

    return hierarchy

# --- GUI Class ---
class HierarchyGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Group Hierarchy Builder")
        self.geometry("600x500")
        self.groups = load_glossary_data("Glossary/GLOSSARY_CEMU_discord_messages.json")
        self.hierarchy = {}
        self.create_sliders()
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True)
        self.update_hierarchy()

    def create_sliders(self):
        slider_params = [
            ("Parent Size Penalty", "lambda_breadth", 0.1, 3.0),
            ("Mu Imbalance Penalty", "mu_imbalance", 0.1, 3.0),
            ("Nu Depth Penalty", "nu_depth", 0.1, 3.0),
            ("Omega Coherence Penalty", "omega_coherence", 0.1, 3.0),
            ("Relevance Threshold", "relevance_threshold", 0.1, 1.0)
        ]

        self.con = False
        for label, key, min_val, max_val in slider_params:
            frame = tk.Frame(self)
            frame.pack(fill="x", padx=10, pady=5)
            tk.Label(frame, text=label, width=20).pack(side="left")
            slider = tk.Scale(frame, from_=min_val, to=max_val, resolution=0.1,
                              orient="horizontal", length=300,
                              command=lambda val, k=key: self.update_params(k, val))

            slider.set(getattr(params, key))

            slider.pack(side="right")

        def update_con():
            self.con = True

        self.after(10000, update_con)

    def update_params(self, key, value):

        setattr(params, key, float(value))
        if self.con == True:

            self.update_hierarchy()

    def update_hierarchy(self):
        groups_flat = {k: list(chain.from_iterable(v if isinstance(v[0], list) else [v])) 
                       for k, v in self.groups.items()}
        self.hierarchy = build_hierarchy(groups_flat)
        #print(self.hierarchy)

        for item in self.tree.get_children():
            self.tree.delete(item)
        self.populate_tree()





    def populate_tree(self):
        def add_nodes(parent, subgroups):
            #print(parent,subgroups)
            for subgroup in subgroups:
                if self.tree.exists(subgroup):
                    self.tree.move(subgroup, parent, "end")
                else:
                    self.tree.insert(parent, "end", subgroup, text=subgroup)
                if subgroup in self.hierarchy:
                    add_nodes(subgroup, self.hierarchy[subgroup]["subgroups"])

        for group, details in self.hierarchy.items():
            if not self.tree.exists(group):
                self.tree.insert("", "end", group, text=group)
                add_nodes(group, details["subgroups"])

# --- Run Application ---
if __name__ == "__main__":
    app = HierarchyGUI()
    app.mainloop()
