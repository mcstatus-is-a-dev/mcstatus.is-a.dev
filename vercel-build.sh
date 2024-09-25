#!/bin/bash
country_name="India"

file="statusPageTemplate.js"
cp "$file" "$file.bak"
sed -i "s/Latency(Country)/Latency(From $country_name)/g" "$file"

echo "File updated successfully."
npm i express
