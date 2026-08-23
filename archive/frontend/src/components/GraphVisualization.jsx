import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export function GraphVisualization({ nodes, links, onNodeClick }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 600;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "cursor-pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", d => 15 + (d.confidence || 0.5) * 15)
      .attr("fill", d => {
        const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981"];
        const depth = (d.path?.length || d.classification?.path?.length || 1) - 1;
        return colors[Math.min(depth, 3)] || "#6366f1";
      })
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2)
      .on("click", (event, d) => onNodeClick?.(d));

    node.append("text")
      .text(d => (d.title || d.summary || "Untitled").slice(0, 20))
      .attr("x", 20)
      .attr("y", 5)
      .attr("fill", "#e2e8f0")
      .attr("font-size", "11px")
      .attr("font-family", "monospace");

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();
  }, [nodes, links]);

  return <svg ref={svgRef} className="w-full h-[600px] glass-panel rounded-xl" />;
}
