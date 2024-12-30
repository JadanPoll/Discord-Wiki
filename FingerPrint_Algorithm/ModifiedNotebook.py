import tkinter as tk
from tkinter import ttk

class Notebook(ttk.Frame):
    def __init__(self, master, takefocus=True, **kwargs):
        ttk.Frame.__init__(self, master, **kwargs)
        self.notebook = notebook = ttk.Notebook(self, takefocus=takefocus)
        self.blankframe = lambda: tk.Frame(self.notebook, height=0, bd=0, highlightthickness=0)

        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        notebook.grid(row=0, column=0, sticky="ew")

        notebook.bind("<<NotebookTabChanged>>", self.on_tab_change)

        self.pages = []
        self.previous_page = None

    def on_tab_change(self, event):
        self.event_generate("<<NotebookTabChanged>>")
        tabId = self.notebook.index(self.notebook.select())
        newpage = self.pages[tabId]
        if self.previous_page:
            self.previous_page.grid_forget()
        newpage.grid(row=1, column=0, sticky="nsew")
        self.previous_page = newpage
        
    def add(self, child, **kwargs):
        if child in self.pages:
            raise ValueError("{} is already managed by {}.".format(child, self))
        self.notebook.add(self.blankframe(), **kwargs)
        self.pages.append(child)

    def insert(self, where, child, **kwargs):
        if child in self.pages:
            raise ValueError("{} is already managed by {}.".format(child, self))
        self.notebook.insert(where, self.blankframe(), **kwargs)
        self.pages.insert(where, child)
        
    def enable_traversal(self):
        self.notebook.enable_traversal()

    def select(self, tabId):
        if not isinstance(tabId, int) and tabId in self.pages:
            tabId = self.pages.index(tabId)
        self.notebook.select(tabId)
    
    def tab(self, tabId, option=None, **kwargs):
        if not isinstance(tabId, int) and tabId in self.pages:
            tabId = self.pages.index(tabId)
        self.notebook.tab(tabId, option, **kwargs)

    def forget(self, tabId):
        if not isinstance(tabId, int):
            tabId = self.pages.index(tabId)
            self.pages.remove(child)
        else:
            del self.pages[tabId]
        self.notebook.forget(self.pages.index(child))

    def index(self, child):
        try:
            return self.pages.index(child)
        except IndexError:
            return self.notebook.index(child)
    
    def tabs(self):
        return self.pages
