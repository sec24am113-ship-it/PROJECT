"""
Gemini Advisor: Generates post-simulation evacuation reports using Hugging Face AI.
Uses free Mistral-7B model for evacuation analysis and recommendations.
"""

import requests
import json
from typing import Dict, Any


class GeminiAdvisor:
    """Generates AI-powered evacuation analysis reports."""

    # Hugging Face Inference API endpoint (free, no key needed)
    HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"

    @staticmethod
    def generate_report(simulation_data: Dict[str, Any]) -> str:
        """
        Generate an evacuation report based on simulation results.
        Uses Hugging Face free API with Mistral model.
        
        Args:
            simulation_data: Simulation results including:
                - total_ticks: Number of simulation ticks
                - total_agents: Number of people
                - evacuated: Number successfully evacuated
                - stuck: Number stuck/trapped
                - rooms: Room data with heat values
                - bottlenecks: Identified congestion areas
                
        Returns:
            Text report with analysis and recommendations
        """
        try:
            # Build prompt
            prompt = GeminiAdvisor._build_prompt(simulation_data)

            # Call Hugging Face API
            headers = {"Content-Type": "application/json"}
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 500,
                    "temperature": 0.7,
                    "top_p": 0.95,
                },
            }

            response = requests.post(
                GeminiAdvisor.HF_API_URL,
                headers=headers,
                json=payload,
                timeout=30,
            )

            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    return result[0].get("generated_text", "Report generation failed.")
                return "Report generation failed."
            else:
                return f"API Error: {response.status_code} - {response.text}"

        except Exception as e:
            return f"Error generating report: {str(e)}"

    @staticmethod
    def _build_prompt(simulation_data: Dict[str, Any]) -> str:
        """
        Build the prompt for the AI advisor.
        
        Args:
            simulation_data: Simulation results
            
        Returns:
            Formatted prompt for Mistral
        """
        evacuation_stats = simulation_data.get("stats", {})
        total_agents = evacuation_stats.get("total_agents", 0)
        evacuated = evacuation_stats.get("evacuated", 0)
        stuck = evacuation_stats.get("stuck", 0)
        ticks = simulation_data.get("total_ticks", 0)

        escape_rate = (evacuated / total_agents * 100) if total_agents > 0 else 0
        success = "SUCCESSFUL" if stuck == 0 else "PROBLEMATIC"

        prompt = f"""You are an expert fire safety consultant analyzing an emergency evacuation simulation.

SIMULATION RESULTS:
- Total People: {total_agents}
- Successfully Evacuated: {evacuated} ({escape_rate:.1f}%)
- Stuck/Trapped: {stuck}
- Simulation Duration: {ticks} ticks
- Overall Status: {success}

Provide a brief, actionable evacuation report (3-4 paragraphs) that includes:
1. Assessment of evacuation efficiency
2. Identified bottlenecks or problem areas
3. Specific design recommendations to improve evacuation times
4. Priority improvements for fire safety

Keep recommendations practical and cost-effective."""

        return prompt
