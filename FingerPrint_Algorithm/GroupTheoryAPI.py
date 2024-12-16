import tkinter as tk
from tkinter import ttk
from itertools import chain
import json

def load_glossary_data(file_path):
    """ Load the glossary data from a JSON file. """
    try:
        with open(file_path, "r") as file:
            data = json.load(file)
            return data
    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return {}
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {file_path}.")
        return {}

class GroupHierarchy:
    def __init__(self, groups):
        """ Initialize the group hierarchy with a list of groups. """
        self.groups = {key: set(chain.from_iterable(
            value if isinstance(value[0], list) else [value])) for key, value in groups.items()}
        self.hierarchical_relationships = {}
        self.independent_groups = set()

    def reset(self,groups):
        """ Initialize the group hierarchy with a list of groups. """
        self.groups = {key: set(chain.from_iterable(
            value if isinstance(value[0], list) else [value])) for key, value in groups.items()}
        self.hierarchical_relationships = {}
        self.independent_groups = set()

    def check_subgroup(self, potential_subgroup, parent_group, slider_value):
        """ Check if a group can be a valid subgroup of the parent group based on the slider value. """
        parent_elements = self.groups[parent_group]
        subgroup_elements = self.groups[potential_subgroup]
        
        if len(subgroup_elements) == 0:
            return False
        
        shared_elements = subgroup_elements & parent_elements
        return (len(shared_elements) / len(subgroup_elements) >= 0.4 - slider_value and 
                len(shared_elements) / len(parent_elements) < 0.2 + slider_value)

    def compute_hierarchy(self, slider_value):
        """ Compute the likely hierarchical ordering based on the intersections of group elements. """
        for group_name in self.groups:
            self.hierarchical_relationships[group_name] = {"subgroups": []}
        
        group_names = list(self.groups.keys())
        group_names.sort(key=lambda group: len(self.groups[group]))
        
        for i, group_name1 in enumerate(group_names):
            for group_name2 in group_names[i+1:]:
                if self.check_subgroup(group_name1, group_name2, slider_value):
                    self.hierarchical_relationships[group_name2]["subgroups"].append(group_name1)
                    break

class GroupHierarchyWithTreeview(GroupHierarchy):
    def __init__(self, groups):
        super().__init__(groups)

    def populate_treeview(self, tree):
        """ Populate the Treeview with hierarchical relationships. """
        added_groups = set()
        
        for group in self.independent_groups:
            if group not in added_groups:
                tree.insert("", "end", group, text=group)
                added_groups.add(group)
        
        for group_name, relationship in self.hierarchical_relationships.items():
            if not tree.exists(group_name):
                tree.insert("", "end", group_name, text=group_name)
            
            for subgroup in relationship["subgroups"]:
                if tree.exists(subgroup):
                    tree.move(subgroup, group_name, "end")
                else:
                    tree.insert(group_name, "end", subgroup, text=subgroup)

def update_clustering(tree,slider_value,custom_groups = None):
    """ Update clustering based on the slider value. """
    global groups
    print("UPdated CLUSTERINGGGGGGGGGGG")
    if custom_groups:

        group_hierarchy.reset( custom_groups)
    # Recompute hierarchy with new slider value
    group_hierarchy.compute_hierarchy(slider_value)
    # Clear and repopulate Treeview
    for item in tree.get_children():
        tree.delete(item)
    group_hierarchy.populate_treeview(tree)


# Define file path for glossary data
file_path = "glossary.json"

# Load group data from the JSON file
groups = load_glossary_data(file_path)

if not groups:
    print("No valid group data found. Exiting...")
    exit()
# Initialize the group hierarchy with loaded data
group_hierarchy = GroupHierarchyWithTreeview(groups)


def main():
    # Define file path for glossary data
    file_path = "glossary.json"
    
    # Load group data from the JSON file
    groups = load_glossary_data(file_path)
    
    if not groups:
        print("No valid group data found. Exiting...")
        return
    
    global group_hierarchy
    global tree
    
    # Initialize the group hierarchy with loaded data
    group_hierarchy = GroupHierarchyWithTreeview(groups)
    
    # Create a Tkinter window
    root = tk.Tk()
    root.title("Group Hierarchy Viewer")


    # Create a frame to contain the widgets
    graph_frame = tk.Frame(root)
    graph_frame.pack(fill="both", expand=True)

    # Create a Treeview widget
    tree = ttk.Treeview(graph_frame)
    tree.heading("#0", text="Group Hierarchy", anchor="w")
    tree.pack(fill="both", expand=True)

    # Create a slider widget
    slider = tk.Scale(graph_frame, from_=0.0, to=1.0, orient='horizontal', resolution=0.01,
                    label="Clustering Sensitivity", command=lambda val: update_clustering(float(val)))
    slider.pack(fill="x")

    root.mainloop()

if __name__ == "__main__":
    main()
