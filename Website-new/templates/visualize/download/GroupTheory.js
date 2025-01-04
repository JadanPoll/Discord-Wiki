
const getUniqueId = (() => {
    const idMap = new WeakMap();
    let id = 0;

    return (obj) => {
        if (!idMap.has(obj)) {
            idMap.set(obj, ++id);
        }
        return idMap.get(obj);
    };
})();


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
        const key = `${getUniqueId(parentSet)}-${getUniqueId(childSet)}`;
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


            for (let i = 0; i < sortedGroups.length; i++) {
                const parent = sortedGroups[i];
            
                if (parent === child || groupSizes[parent] <= childSize) {
                    continue;
                }
            
                const cost = this.calculateCost(groupSets[parent], childSet, groupSizes[parent], childSize, overlapCache);
            
                if (cost < minCost) {
                    minCost = cost;
                    bestParent = parent;
            
                    // Early exit if cost is "good enough"
                    if (cost < 5.0) {
                        break;
                    }
                }
            }
            
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

export {  GroupHierarchy, GroupHierarchyWithTreeview, generateSubtopicTreeAndDisplayTree };
