// Required Imports
import { TextBlob } from 'textblob';
import KneeLocator from 'knee-locator';
import { TextRank4Keyword } from 'textrank4keyword';
import glossal_compression from './glossal_compression';
import GroupTheoryAPINonGUI2 from './GroupTheoryAPINonGUI2';

// Utility Functions
function loadGlossaryData(filePath) {
    /**
     * Load the glossary data from a JSON file.
     * @param {string} filePath - Path to the JSON file.
     * @returns {Object} Parsed data or an empty object on error.
     */
    try {
        const fs = require('fs');
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {};
    }
}

// GroupHierarchy Class
class GroupHierarchy {
    constructor(groups = {}) {
        this.params = {
            lambdaBreadth: 0.5,
            muImbalance: 0.5,
            nuDepth: 0.3,
            omegaCoherence: 3.0,
            relevanceThreshold: 0.6
        };
        this.reset(groups);
    }

    reset(groups) {
        this.groups = this._processGroups(groups);
        this.hierarchicalRelationships = {};
        this.independentGroups = new Set();
    }

    _processGroups(groups) {
        return Object.fromEntries(
            Object.entries(groups).map(([key, value]) => {
                const values = Array.isArray(value[0]) ? value.flat() : value;
                return [key, new Set(values)];
            })
        );
    }

    static precomputeGroups(groups) {
        const groupSets = Object.fromEntries(
            Object.entries(groups).map(([group, members]) => [group, new Set(members)])
        );
        const groupSizes = Object.fromEntries(
            Object.entries(groupSets).map(([group, members]) => [group, members.size])
        );
        return { groupSets, groupSizes };
    }

    static cachedOverlap(parentSet, childSet, cache) {
        const key = `${parentSet}-${childSet}`;
        if (!(key in cache)) {
            cache[key] = new Set([...parentSet].filter(x => childSet.has(x))).size;
        }
        return cache[key];
    }

    calculateCost(parentSet, childSet, parentSize, childSize, overlapCache) {
        const overlap = GroupHierarchy.cachedOverlap(parentSet, childSet, overlapCache);
        if (overlap === 0 || childSize === 0) {
            return Infinity;
        }
        const relevance = overlap / childSize;
        if (relevance <= this.params.relevanceThreshold) {
            return Infinity;
        }

        const breadthPenalty = this.params.lambdaBreadth * Math.max(parentSize / childSize, 1);
        const coherencePenalty = this.params.omegaCoherence * Math.max(overlap / Math.max(parentSize, childSize), 1e-5);

        return (1 / relevance) + breadthPenalty + coherencePenalty;
    }

    buildHierarchy() {
        const hierarchy = {};
        const assignedChildren = new Set();
        const { groupSets, groupSizes } = GroupHierarchy.precomputeGroups(this.groups);
        const overlapCache = {};
        const depthTracker = Object.fromEntries(Object.keys(this.groups).map(group => [group, 0]));

        const sortedGroups = Object.keys(this.groups).sort((a, b) => groupSizes[a] - groupSizes[b]);

        sortedGroups.forEach(child => {
            const childSet = groupSets[child];
            const childSize = groupSizes[child];
            let minCost = Infinity;
            let bestParent = null;

            sortedGroups.forEach(parent => {
                if (parent === child || groupSizes[parent] <= childSize) {
                    return;
                }

                const cost = this.calculateCost(groupSets[parent], childSet, groupSizes[parent], childSize, overlapCache);
                if (cost < minCost) {
                    minCost = cost;
                    bestParent = parent;
                }
            });

            if (bestParent) {
                if (!hierarchy[bestParent]) {
                    hierarchy[bestParent] = { subgroups: [] };
                }
                hierarchy[bestParent].subgroups.push(child);
                assignedChildren.add(child);
                depthTracker[child] = depthTracker[bestParent] + 1;
            }
        });

        Object.keys(this.groups).forEach(group => {
            if (!assignedChildren.has(group)) {
                if (!hierarchy[group]) {
                    hierarchy[group] = { subgroups: [] };
                }
            }
        });

        this.hierarchicalRelationships = hierarchy;
        return hierarchy;
    }

    getHierarchy() {
        return this.hierarchicalRelationships;
    }
}

// GroupHierarchyWithTreeview Subclass
class GroupHierarchyWithTreeview extends GroupHierarchy {
    populateTreeview(tree) {
        const addedGroups = new Set();

        this.independentGroups.forEach(group => {
            if (!addedGroups.has(group)) {
                tree.insert('', 'end', group, { text: group });
                addedGroups.add(group);
            }
        });

        Object.entries(this.hierarchicalRelationships).forEach(([groupName, relationship]) => {
            if (!tree.exists(groupName)) {
                tree.insert('', 'end', groupName, { text: groupName });
            }

            relationship.subgroups.forEach(subgroup => {
                if (tree.exists(subgroup)) {
                    tree.move(subgroup, groupName, 'end');
                } else {
                    tree.insert(groupName, 'end', subgroup, { text: subgroup });
                }
            });
        });
    }
}

function generateSubtopicTreeAndDisplayTree(customGroups) {
    console.log("Updated CLUSTERINGGGGGGGGGGG");
    if (customGroups) {
        groupHierarchy.reset(customGroups);
    }
    groupHierarchy.buildHierarchy();
    return {
        independentGroups: groupHierarchy.independentGroups,
        hierarchicalRelationships: groupHierarchy.hierarchicalRelationships
    };
}

const groupHierarchy = new GroupHierarchyWithTreeview({});

export { loadGlossaryData, GroupHierarchy, GroupHierarchyWithTreeview, generateSubtopicTreeAndDisplayTree };
