import React from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Card } from "../components/Card";

export const Home = () => {
  const theme = useCurrentTheme();
  return (
    <div className="plain-page">
      <img
        src="./assets/Dynatrace_Logo.svg"
        alt="Dynatrace Logo"
        width={150}
        height={150}
        style={{ paddingBottom: 32 }}
      ></img>

      <h2>Welcome To Your Dynatrace App</h2>
      <p>
        Edit <strong>ui/app/pages/Home.tsx</strong> and save to reload the app.
      </p>
      <p>
        For more information and help on app development, check out the
        following:
      </p>

      <div className="custom-card-grid">
        <Card
          href="/data"
          inAppLink
          imgSrc={
            theme === "light" ? "./assets/data.png" : "./assets/data_dark.png"
          }
          name="Explore data"
        />
        <Card
          href="https://dt-url.net/developers"
          imgSrc={
            theme === "light"
              ? "./assets/devportal.png"
              : "./assets/devportal_dark.png"
          }
          name="Dynatrace Developer"
        />
        <Card
          href="https://dt-url.net/devcommunity"
          imgSrc={
            theme === "light"
              ? "./assets/community.png"
              : "./assets/community_dark.png"
          }
          name="Developer Community"
        />
      </div>
    </div>
  );
};
