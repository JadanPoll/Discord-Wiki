import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import moment from "moment";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./Listfiles.module.css";
import io from 'socket.io-client';


// Set up the Socket.io connection (adjust the URL if needed)
const socket = io(`${location.hostname || 'localhost'}:5000`);



const FileCard = ({ data, deleteFile, navigate }) => {
	const [nfcActive, setNfcActive] = useState(false);
	const [nfcCode, setNfcCode] = useState(null);
	const [nfcHovered, setNfcHovered] = useState(false);
	const discordDatamgr = new DiscordDataManager();

  
	useEffect(() => {
	  // Listener for NFC code creation response
	  socket.on('nfc_success_created_code_for_dserver', (response) => {
		console.log('NFC code created event received:', response);
		setNfcCode(response.nfc_code);
	  });
  
	  // Listener for NFC responses (if any)
	  socket.on('nfc_all_dservers_cleared', (response) => {
		console.log('NFC response received:', response);
	  });
  
	  // Listener for NFC code matched event
	  socket.on('nfc_request_made_for_host_dserver', async (response) => {
		console.log('NFC data request packet received:', response);
  
		try {
		  // Gather the required data from DiscordDataManager
		  const relationships = await discordDatamgr.getRelationships(data.id);

  
		  // Replace 'someTopic' with the actual topic as needed
		  const summary = await discordDatamgr.getSummary(data.id, 'someTopic');

  
		  const convBlocks = await discordDatamgr.getConversationBlocks(data.id);
  
		  const glossary = await discordDatamgr.getGlossary(data.id);
  
		  // Share the data to the requesting device via a custom event.
		  // It sends back all the gathered data along with the NFC code.
		  socket.emit('nfc_share_dserver_to_requesting_device', {
			requesting_device: response.requesting_device,
			nfc_code: response.nfc_code,
			id: data.id,
			nickname:data.nickname,
			relationships:relationships,
			summary:summary,
			conversation_blocks:convBlocks,
			glossary:glossary,
		  });
		} catch (error) {
		  console.error('Error processing NFC code matched:', error);
		}
	  });
  
	  // Listener for NFC errors
	  socket.on('nfc_error', (error) => {
		console.error('NFC error:', error.error);
	  });
  
	  return () => {
		socket.off('nfc_code_created');
		socket.off('nfc_response');
		socket.off('nfc_code_matched');
		socket.off('nfc_error');
	  };
	}, [data.id, discordDatamgr]);
  
	// Handle NFC label click: Request NFC code generation if needed
	const handleNfcClick = (e) => {
	  e.stopPropagation();
	  console.log(`NFC clicked — ID: ${data.id}`);
  
	  if (!nfcActive && !nfcCode) {
		console.log("Emitting signal to generate NFC code");
		socket.emit('nfc_create_nfc_link_to_this_dserver', { title: data.nickname });
	  }
	  setNfcActive((prev) => !prev);
	};
  
	const handleNfcMouseEnter = (e) => {
	  e.stopPropagation();
	  setNfcHovered(true);
	  if (nfcActive && nfcCode) {
		console.log(`NFC code server: ${nfcCode}`);
		// You can also emit a verification request here if desired
	  }
	};
  
	const handleNfcMouseLeave = (e) => {
	  e.stopPropagation();
	  setNfcHovered(false);
	};
  
	return (
	  <div
		className={`${styles.card} card nfc-card`}
		style={{
		  "--cd-img": `url(${data.imageUrl || "path/to/default-image.webp"})`,
		}}
	  >
		<div className={`card-body ${data.isActive ? "shadow" : ""}`}>
		  <h5 className="card-title">{data.nickname}</h5>
		  <h6 className="card-subtitle mb-2 text-body-secondary">
			ID: {data.id}
		  </h6>
		  <p className="card-text">Created at {data.datetime}</p>
  
		  {data.isActive ? (
			<span className="card-link">
			  <i>Active File</i>
			</span>
		  ) : (
			<a
			  href="#"
			  className="card-link"
			  onClick={(e) => {
				e.stopPropagation();
				discordDatamgr.setActiveServerDisc(data.id);
				navigate(0); // Reload page to update active file status
			  }}
			>
			  Set as active file
			</a>
		  )}
  
		  <a
			href="#"
			className="card-link"
			onClick={(e) => {
			  e.stopPropagation();
			  deleteFile(data.id, e);
			}}
		  >
			Delete
		  </a>
  
		  {/* NFC label */}
		  <div
			className={`${styles["nfc-label"]} ${nfcActive ? styles.active : ""}`}
			onClick={handleNfcClick}
			onMouseEnter={handleNfcMouseEnter}
			onMouseLeave={handleNfcMouseLeave}
		  >
			{nfcHovered && nfcCode ? `NFC: ${nfcCode}` : "NFC"}
		  </div>
		</div>
	  </div>
	);
  };
  

const Listfiles = () => {
	const navigate = useNavigate();
	const [dbdata, setDbdata] = useState(null);
	const [activefile, setActiveFile] = useState(null);
	
	useEffect(() => {
		const fetchFiles = async () => {
			const ans = [];
			const discordData = new DiscordDataManager();
			const dblist = await discordData.getDBServersObjList();
			const active = await discordData.getActiveServerDisc();
			setActiveFile(active);
			
			// Process each file from the DB list.
			for (const element of dblist) {
				const nickname = await discordData.getChannelNickname(element);
				let gameDiscImageUrl = await discordData.getServerGameDisc(element);
				if (!gameDiscImageUrl) {
					gameDiscImageUrl = null;
				}
				// Extract epoch value from filename and format it.
				const epoch = (element.split("_")[1] * 1) / 1000;
				ans.push({
					id: element,
					nickname: nickname,
					isActive: element === active,
					datetime: moment.unix(epoch).format("LLL"),
					imageUrl: gameDiscImageUrl,
				});
			}
			
			setDbdata(ans);
		};
		
		fetchFiles();
	}, []);
	
	const deleteFile = async (id, e) => {
		e.stopPropagation();
		const discordData = new DiscordDataManager();
		
		if (id === (await discordData.getActiveServerDisc())) {
			alert(
				"You are about to delete the active file. The newest file will become the next active file."
			);
		}
		
		if (!window.confirm("You are about to delete this file. Continue?")) {
			alert("Aborted.");
			return;
		}
		
		await discordData.removeChannel(id);
		setActiveFile(null);
	};
	
	const purge = async () => {
		if (
			!window.confirm(
				"You are about to remove all saved data. THIS ACTION IS IRREVERSIBLE. Continue?"
			)
		) {
			alert("Aborted.");
			return;
		}
		
		if (
			!window.confirm(
				"Again, this will remove ALL DATA. Are you really sure? THIS IS YOUR LAST CHANCE!"
			)
		) {
			alert("Aborted.");
			return;
		}
		
		const discordData = new DiscordDataManager();
		await discordData.purge();
		navigate("/");
	};
	
	if (dbdata === null) return <div>Loading...</div>;
	
	return (
		<>
		<Helmet>
		<title>Files Available</title>
		</Helmet>
		<div id="content-body" className="container container-fluid">
		<h1>Files Available</h1>
		{dbdata.length === 0 ? (
			// When no files exist, display a unique card using the default image.
			<div
			className={`${styles.card} card`}
			style={{
				"--cd-img": `url(./blue-logo.png)`,
			}}
			>
			<div className="card-body">
			<h5 className="card-title">Load Demo Titles</h5>
			<p className="card-text">
			Let's get started! Check out some demo titles!
			</p>
			<Link to="/loaddemo" className="card-link">
			Load a file
			</Link>
			</div>
			</div>
		) : (
			<>
			{dbdata.map((data) => (
				<FileCard
				key={data.id}
				data={data}
				deleteFile={deleteFile}
				navigate={navigate}
				/>
			))}
			{/* Extra card with a unique image that links to /loaddemo */}
			<div className={`${styles.card} card`}>
			<Link to="/loaddemo">
			<div
			className="card-img-top"
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				height: "200px", // Adjust height as needed
			}}
			>
			<img
			src="/website-icon-transparent.jpg"
			alt="Load Demo"
			style={{
				width: "80%",
				objectFit: "contain", // Preserve aspect ratio
				opacity: 0.1,
			}}
			/>
			</div>
			</Link>
			</div>
			</>
		)}
		<div>
		<button
		type="button"
		className="btn btn-danger float-end mx-1"
		onClick={purge}
		>
		Delete All Files
		</button>
		<Link
		to="/download"
		className="btn btn-primary mx-1 float-end"
		role="button"
		>
		Load a file
		</Link>
		</div>
		</div>
		</>
	);
};

export default Listfiles;
