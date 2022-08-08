import React, {useState, useEffect} from "react";
import {
    Viewer,
    CameraFlyTo, Camera,
    ScreenSpaceEventHandler,
    ScreenSpaceEvent,
    PolylineGraphics,
    EntityDescription,
    PointGraphics,
    Entity,
} from "resium";
import {IonResource, ScreenSpaceEventType, Cartesian3,Color, createWorldTerrain} from "cesium";
import socketIOClient from "socket.io-client";

const trackerStyle = {
    position: "fixed",
    padding: '0px 16px',
    height: "20px",
    top: "10px",
    left: "50%",
    transform: 'translateX(-50%)',
    zIndex: 100,
};

const buttonStyle = {
    position: "fixed",
    width: "100px",
    height: "20px",
    top: "10px",
    left: "100px",
    zIndex: 100,
    backgroundColor: "white",
    pointer: 'cursor',
};

class InteractiveMap extends React.Component {

    static SERVER_URL = "http://127.0.0.1:8000";

    viewer;
    socket;

    constructor(props) {
        super(props);
        this.state = {positions: [], connectionState: 'Connecting', lastRecordedPingAt: null};
    }

    componentDidMount() {
        this.connectToServer();
    }

    componentWillUnmount() {
        if(this.socket) {
            this.socket.close();
        }
    }

    connectToServer() {
        this.socket = socketIOClient(InteractiveMap.SERVER_URL);
        this.socket.on('connect', () => {
            this.setConnectionState('Online');
        });

        this.socket.on('ping', () => {
            const current = Date.now();
            this.setState((state) => {
                return {...state, lastRecordedPingAt: current, connectionState: 'Online'};
            })
            setTimeout(()=>{
                if(this.state?.lastRecordedPingAt){
                    if(Date.now() - this.state.lastRecordedPingAt > 2000) {
                        this.setConnectionState('Offline');
                    }
                }
            }, 2001);
        });

        this.socket.on('connect_failed', () => {
            this.setConnectionState('Offline');
        });

        this.socket.on('disconnect', () => {
            this.setConnectionState('Offline');
        });

    }

    setConnectionState(connectionState) {
        this.setState(state => {
            return {...state, connectionState: connectionState};
        })
    }

    onRightClick(movement) {
        this.setState(state => {
            const coordinatesRadians = this.getCoordinatesFromMovementPosition(movement.position);
            if (coordinatesRadians) {
                const clickedPosition = Cartesian3.fromRadians(coordinatesRadians.longitude, coordinatesRadians.latitude, coordinatesRadians.altitude);
                return {...state, positions: [...state.positions, clickedPosition]};
            } else return state;
        });
    }

    getCoordinatesFromMovementPosition(position) {
        const scene = this.viewer.scene;
        if (scene) {
            const ellipsoid = scene.globe.ellipsoid;
            if (ellipsoid) {
                const cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                if (cartesian) {
                    return ellipsoid.cartesianToCartographic(cartesian);
                }
            }
        }
        return null;
    }

    resetPolylinePositions() {
        this.setState(state => {
            return {...state, positions: []}
        });
    }

    savePath() {
        if (this.state.connectionState === 'Online') {
            const positions = this.state.positions;
            if (positions.length > 0) {
                this.sendPositionsOverSocket(positions);
            }
        }
    }

    sendPositionsOverSocket(positions) {
        if (this.socket) {
            this.socket.emit('save-path', positions);
        }
    }


    render() {
        const dynamicTrackerStyle = {
            ...trackerStyle,
        };
        switch (this.state.connectionState) {
            case "Connecting":
                dynamicTrackerStyle.backgroundColor = 'yellow';
                break;
            case "Online":
                dynamicTrackerStyle.backgroundColor = 'green';
                break;
            case "Offline":
                dynamicTrackerStyle.backgroundColor = 'red';
                break;
            default:
                dynamicTrackerStyle.display = 'none';
                break;
        }

        const buttonIsEnabled = this.state.positions?.length > 0 && this.state.connectionState === 'Online';
        const dynamicButtonStyle = {
            ...buttonStyle,
            opacity: buttonIsEnabled ? '1' : '0.1',
            cursor: buttonIsEnabled ? 'cursor' : 'auto',
        };

        document.addEventListener('contextmenu', (e) => {
            if (e.shiftKey) {
                this.resetPolylinePositions()
            }
        });

        return (

            <Viewer
                full
                timeline={false}
                homeButton={false}
                navigationHelpButton={false}
                sceneModePicker={false}
                terrainProvider={this.terrainProvider}

                ref={e => {
                    this.viewer = e && e.cesiumElement;
                    if(this.viewer) {
                        // eslint-disable-next-line no-undef
                        this.viewer.imageryProvider = Cesium.createWorldImagery({
                            // eslint-disable-next-line no-undef
                            style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS
                        });
                    }
                }}>

                <Entity>
                    <PolylineGraphics positions={this.state.positions}/>
                </Entity>

                <div style={dynamicTrackerStyle}>
                    {this.state.connectionState}
                </div>

                {this.state.positions.map((position, i) => {
                    return (
                        <Entity
                            key={JSON.stringify(position) + i}
                            name={"Position Number " + i + 1}
                            description={"Position: " + JSON.stringify(position)}
                            position={position}
                            point={{ pixelSize: 10 }}
                        />
                    );
                })}

                <ScreenSpaceEventHandler>
                    <ScreenSpaceEvent action={movement => this.onRightClick(movement)}
                                      type={ScreenSpaceEventType.RIGHT_CLICK}/>
                </ScreenSpaceEventHandler>

                <button style={dynamicButtonStyle} onClick={() => this.savePath()}>Save Path</button>
            </Viewer>
        );
    }
}

export default InteractiveMap;
