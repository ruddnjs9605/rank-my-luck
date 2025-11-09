import React from "react";
import { Outlet } from "react-router-dom";
import TopBar from "./components/TopBar";
import "./styles.css";

export default function App(){
  return (
    <div className="page">
      <TopBar />
      <div style={{flex:1}}>
        <Outlet />
      </div>
    </div>
  );
}
