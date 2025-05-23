import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import moment from "moment";
import { DiscordDataManager } from "../lib/DiscordDataManger";
import styles from "./Listfiles.module.css";
import io from 'socket.io-client';


// Set up the Socket.io connection (adjust the URL if needed)
const socket = io(location.hostname === 'localhost' || location.hostname === '' 
	? 'http://127.0.0.1:5000' 
	: `${location.protocol}//${location.hostname}`);
  
console.log("Should only run once");
console.log(`Protocol being used ${location.protocol}//${location.hostname}`);


const FileCard = ({ data, deleteFile, navigate }) => {
	const [nfcActive, setNfcActive] = useState(false);
	const [nfcCode, setNfcCode] = useState(null);
	const [nfcHovered, setNfcHovered] = useState(false);
	const discordDatamgr = new DiscordDataManager();

	useEffect(() => {
		const id = data.id;

		const handleNfcCodeCreated = (response) => {
			console.log(`NFC code created for ${id}:`, response);
			setNfcCode(response.nfc_code);
		};

		const handleAllCleared = (response) => {
			console.log(`All cleared (nfc_all_dservers_cleared) for ${id}:`, response);
		};

		const handleMatched = async (response) => {
			console.log(`NFC match for ${id}:`, response);

			try {
				const relationships = await discordDatamgr.getRelationships(id);
				const summary = await discordDatamgr.getAllSummariesForChannel(id);
				const convBlocks = await discordDatamgr.getConversationBlocks(id);
				const glossary = await discordDatamgr.getGlossary(id);
				socket.emit(`nfc_share_dserver_to_requesting_device`, {
					requesting_device: response.requesting_device,
					nfc_code: response.nfc_code,
					id,
					nickname: data.nickname,
					imageUrl: data.imageUrl,
					relationships,
					summary,
					conversation_blocks: convBlocks,
					glossary
				});
			} catch (error) {
				console.error(`Error processing NFC code match for ${id}:`, error);
			}
		};

		const handleError = (error) => {
			console.error(`NFC error for ${id}:`, error.error);
		};

		// Register all listeners with namespaced events
		socket.on(`nfc_success_created_code_for_dserver:${id}`, handleNfcCodeCreated);
		socket.on(`nfc_all_dservers_cleared:${id}`, handleAllCleared);
		socket.on(`nfc_request_made_for_host_dserver:${id}`, handleMatched);
		socket.on(`nfc_error:${id}`, handleError);

		// Cleanup
		return () => {
			socket.off(`nfc_success_created_code_for_dserver:${id}`, handleNfcCodeCreated);
			socket.off(`nfc_all_dservers_cleared:${id}`, handleAllCleared);
			socket.off(`nfc_request_made_for_host_dserver:${id}`, handleMatched);
			socket.off(`nfc_error:${id}`, handleError);
		};
	}, [data.id]);

	const handleNfcClick = (e) => {
		e.stopPropagation();
		console.log(`NFC clicked — ID: ${data.id}`);

		if (!nfcActive && !nfcCode) {
			console.log("Requesting NFC code for", data.id);
			socket.emit('nfc_create_nfc_link_to_this_dserver', {
				id: data.id,
				title: data.nickname,
			});
		}
		setNfcActive((prev) => !prev);
	};

	const handleNfcMouseEnter = (e) => {
		e.stopPropagation();
		setNfcHovered(true);
		if (nfcActive && nfcCode) {
			console.log(`NFC code for ${data.id}: ${nfcCode}`);
		}
	};

	const handleNfcMouseLeave = (e) => {
		e.stopPropagation();
		setNfcHovered(false);
	};

	return (
		<div
			className={`${styles.card} card nfc-card`}
			style={{ "--cd-img": `url(${data.imageUrl || "path/to/default-image.webp"})` }}
		>
			<div className={`card-body ${data.isActive ? "shadow" : ""}`}>
				<h5 className="card-title">{data.nickname}</h5>
				<h6 className="card-subtitle mb-2 text-body-secondary">ID: {data.id}</h6>
				<p className="card-text">Created at {data.datetime}</p>

				{data.isActive ? (
					<span className="card-link">
						<i>Active Title</i>
					</span>
				) : (
					<a href="#" className="card-link" onClick={(e) => {
						e.stopPropagation();
						discordDatamgr.setActiveServerDisc(data.id);
						navigate(0);
					}}>
						Set as active title
					</a>
				)}

				<a href="#" className="card-link" onClick={(e) => {
					e.stopPropagation();
					deleteFile(data.id, e);
				}}>
					Delete
				</a>

				<div
					className={`${styles["nfc-label"]} ${nfcActive ? styles.active : ""}`}
					onClick={handleNfcClick}
					onMouseEnter={handleNfcMouseEnter}
					onMouseLeave={handleNfcMouseLeave}
				>
					{nfcActive && nfcCode ? `NFC: ${nfcCode}` : "NFC"}
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
				"You are about to delete the active file. The newest file will become the next active title."
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
		<title>Titles</title>
		</Helmet>
		<div id="content-body" className="container container-fluid">
		<h1>Titles</h1>
		{dbdata.length === 0 ? (
			// When no files exist, display a unique card using the default image.
			<div
			className={`${styles.card} card`}
			style={{
				"--cd-img": `url(/blue-logo.png)`,
			  }}			  
			>
			<div className="card-body">
			<h5 className="card-title">Load Demo Titles</h5>
			<p className="card-text">
			Let's get started! Check out some demo titles!
			</p>
			<Link to="/xmenu" className="card-link">
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
			{/* Extra card with a unique image that links to /xmenu */}
			<div className={`${styles.card} card`}>
			<Link to="/xmenu">
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
