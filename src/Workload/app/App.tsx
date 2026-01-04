import React from "react";
import { Route, Router, Switch } from "react-router-dom";
import { History } from "history";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { FluentProvider } from "@fluentui/react-components";
import { fabricLightTheme } from "./theme";
import {
    DQCheckerItemEditor,
    DQCheckerItemAbout,
    DQCheckerItemSettings,
} from "./items/DQCheckerItem";

/*
    DQ Checker - Data Quality Workload

    Routes for the DQ Checker workload item editor.
*/

interface AppProps {
    history: History;
    workloadClient: WorkloadClientAPI;
}

export interface PageProps {
    workloadClient: WorkloadClientAPI;
    history?: History
}

export interface ContextProps {
    itemObjectId?: string;
    workspaceObjectId?: string
    source?: string;
}

export interface SharedState {
    message: string;
}

export function App({ history, workloadClient }: AppProps) {
    return (
        <FluentProvider theme={fabricLightTheme}>
            <Router history={history}>
                {/* Test route for debugging */}
                <Route exact path="/">
                    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
                        <h1>DQ Checker Workload</h1>
                        <p>Current URL: {window.location.href}</p>
                        <p>Workload Name: {process.env.WORKLOAD_NAME}</p>
                        <p style={{ color: '#666' }}>
                            Navigate to /DQCheckerItem-editor/:itemObjectId to see the editor.
                        </p>
                    </div>
                </Route>
                <Switch>
                    {/* DQ Checker Item Editor */}
                    <Route path="/DQCheckerItem-editor/:itemObjectId">
                        <DQCheckerItemEditor
                            workloadClient={workloadClient}
                            data-testid="DQCheckerItem-editor"
                        />
                    </Route>
                    {/* DQ Checker Item About Page (Settings Dialog - outer Fabric toolbar) */}
                    <Route path="/DQCheckerItem-about/:itemObjectId">
                        <DQCheckerItemAbout />
                    </Route>
                    {/* DQ Checker Item Settings/Preferences (Settings Dialog - outer Fabric toolbar) */}
                    <Route path="/DQCheckerItem-settings/:itemObjectId">
                        <DQCheckerItemSettings workloadClient={workloadClient} />
                    </Route>
                </Switch>
            </Router>
        </FluentProvider>
    );
}
