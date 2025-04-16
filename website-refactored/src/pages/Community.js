// Community.js
// This component enables users to share and explore community wiki titles and analyses globally.
// It is inspired by Analyse.js and Listfiles.js and displays a grid of group image logos.
// Clicking a group card navigates to a detailed wiki page.
// Users can also upload new wiki content.
// Future development ideas include:
// - Ghost links for encouraging users to post/share high-quality wikis
// - Quality filtering to ensure only valuable content is shared

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import styles from "./Community.module.css"; // Ensure you create a matching CSS module

// Simulated API function to fetch community groups data.
// In a real-world scenario, replace this with a fetch call to your backend.
const fetchCommunityGroups = async () => {
  return [
    {
      id: "uiuc",
      name: "UIUC",
      imageUrl: "./community/UIUC/UIUC_logo.png", // Path to UIUC logo or group image
      description: "Explore RSOs, academic groups, and community projects at UIUC."
    },
    {
      id: "tech",
      name: "Tech Enthusiasts",
      imageUrl: "/assets/tech-logo.png",
      description: "Discover cutting-edge technology, coding projects, and innovation."
    },
    {
      id: "research",
      name: "Research Nexus",
      imageUrl: "/assets/research-logo.png",
      description: "Collaborate on scholarly work, share papers, and explore discoveries together."
    }
    
    // Add more groups as needed...
  ];
};

const Community = () => {
  const [communityData, setCommunityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const getData = async () => {
      const data = await fetchCommunityGroups();
      setCommunityData(data);
      setLoading(false);
    };
    getData();
  }, []);

  // Filter groups based on search term.
  const filteredGroups = communityData.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Navigate to the detailed page for a selected group.
  const handleCardClick = (groupId) => {
    navigate(`/community/${groupId}`);
  };

  return (
    <>
      <Helmet>
        <title>Community Wiki Hub</title>
      </Helmet>
      <div className={styles.communityContainer}>
        <header className={styles.header}>
          <h1>Community Wiki Hub</h1>
          <p>
            Discover and share high-quality wiki content from communities around the globe.
          </p>
          <input
            type="text"
            placeholder="Search community groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </header>
        <main className={styles.mainContent}>
          {loading ? (
            <div className={styles.loading}>Loading community groups...</div>
          ) : (
            <div className={styles.grid}>
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className={styles.card}
                  onClick={() => handleCardClick(group.id)}
                >
                  <div
                    className={styles.cardImage}
                    style={{ backgroundImage: `url(${group.imageUrl})` }}
                  />
                  <div className={styles.cardContent}>
                    <h2 className={styles.cardTitle}>{group.name}</h2>
                    <p className={styles.cardDescription}>{group.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <footer className={styles.footer}>
          <button
            className={styles.uploadButton}
            onClick={() => navigate("/share_hub")}
          >
            Share Your Wiki
          </button>
        </footer>
      </div>
    </>
  );
};


export default Community;
