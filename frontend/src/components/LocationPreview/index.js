import React, { useEffect } from 'react';
import toastError from "../../errors/toastError";

import { Button, Divider, Typography} from "@material-ui/core";

const LocationPreview = ({ image, link, description }) => {
    useEffect(() => {}, [image, link, description]);

    const handleLocation = async() => {
        try {
            // ID-043: Validar protocolo da URL antes de abrir para prevenir XSS via javascript:
            if (link && /^https?:\/\//i.test(link)) {
                window.open(link, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            toastError(err);
        }
    };

    return (
		<>
			<div style={{
				minWidth: "250px",
			}}>
				<div>
					<div style={{ float: "left" }}>
						<img src={image} alt="loc" onClick={handleLocation} style={{ width: "100px", cursor: "pointer" }} />
					</div>
					{ description && (
					<div style={{ display: "flex", flexWrap: "wrap" }}>
						<Typography style={{ marginTop: "12px", marginLeft: "15px", marginRight: "15px", float: "left" }} variant="subtitle1" color="primary" gutterBottom>
							{/* ID-043: Renderização segura de texto sem dangerouslySetInnerHTML */}
							<div style={{ whiteSpace: "pre-line" }}>{description}</div>
						</Typography>
					</div>
					)}
					<div style={{ display: "block", content: "", clear: "both" }}></div>
					<div>
						<Divider />
						<Button
							fullWidth
							color="primary"
							onClick={handleLocation}
							disabled={!link || !/^https?:\/\//i.test(link)}
						>Visualizar</Button>
					</div>
				</div>
			</div>
		</>
	);

};

export default LocationPreview;
