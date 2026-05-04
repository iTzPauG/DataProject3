import { Redirect } from "expo-router";
import React from "react";

export default function ExploreTab() {
  return <Redirect href="/(flow)/category?categoryId=food" />;
}
