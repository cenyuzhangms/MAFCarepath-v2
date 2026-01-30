"""
Healthcare multi-agent handoff workflow built on Microsoft Agent Framework.

Five agents:
1) Patient Companion
2) Clinical Triage
3) Diagnostics and Orders
4) Coverage and Prior Auth
5) Care Coordination
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from agent_framework import ChatAgent, MCPStreamableHTTPTool
from agent_framework.azure import AzureOpenAIChatClient

from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


AGENT_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "patient_companion": {
        "name": "Patient Companion",
        "description": "Patient-facing intake, symptom capture, education, and check-ins",
        "tools": [],
        "instructions": (
            "You are the Patient Companion Agent for a general healthcare care team.\n"
            "Your job is patient-facing intake, symptom capture, education, and safety checks.\n"
            "You do NOT make final clinical decisions.\n\n"
            "Do NOT assume oncology or chemotherapy unless the patient explicitly says so.\n"
            "When asked to perform intake, return ONLY JSON with the following fields:\n"
            "{\n"
            '  "symptom_report": {\n'
            '    "temperature_f": string|null,\n'
            '    "temperature_c": string|null,\n'
            '    "onset_time": string|null,\n'
            '    "symptoms": [string],\n'
            '    "meds_taken": [string],\n'
            '    "allergies": [string],\n'
            '    "comorbidities": [string],\n'
            '    "wearable_vitals": { "heart_rate": string|null, "spo2": string|null }|null,\n'
            '    "photos": [string],\n'
            '    "language": string|null\n'
            "  },\n"
            '  "risk_flags": [string],\n'
            '  "triage_ticket": string,\n'
            '  "questions_for_patient": [string],\n'
            '  "handoff_contract": {\n'
            '    "case_id": string,\n'
            '    "task_type": "triage",\n'
            '    "inputs": object,\n'
            '    "constraints": object,\n'
            '    "required_approvals": [string],\n'
            '    "output_artifacts": [string],\n'
            '    "audit_log_ref": string\n'
            "  }\n"
            "}\n\n"
            "If information is missing, leave fields null and include clarifying questions.\n"
            "Never provide medical advice; focus on intake and safety reminders."
        ),
    },
    "clinical_triage": {
        "name": "Clinical Triage",
        "description": "Clinician-facing triage using EHR context; proposes disposition",
        "tools": [],
        "instructions": (
            "You are the Clinical Triage Agent for general urgent symptoms.\n"
            "You review the symptom report and EHR context to propose urgency and disposition.\n"
            "You do NOT finalize clinical disposition; requires RN/MD signoff.\n\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            "Return ONLY JSON with:\n"
            "{\n"
            '  "triage_assessment": {\n'
            '    "urgency_level": "emergent|urgent|routine",\n'
            '    "recommended_disposition": string,\n'
            '    "rationale": [string],\n'
            '    "needs_human_signoff": true,\n'
            '    "escalation_flags": [string]\n'
            "  },\n"
            '  "handoff_contract": {\n'
            '    "case_id": string,\n'
            '    "task_type": "triage",\n'
            '    "inputs": object,\n'
            '    "constraints": object,\n'
            '    "required_approvals": [string],\n'
            '    "output_artifacts": [string],\n'
            '    "audit_log_ref": string\n'
            "  }\n"
            "}\n"
            "Be concise and list key EHR-dependent factors."
        ),
    },
    "diagnostics_orders": {
        "name": "Diagnostics and Orders",
        "description": "Drafts orders, SBAR handoff, medication options",
        "tools": [],
        "instructions": (
            "You are the Diagnostics and Orders Agent.\n"
            "Draft the work: lab/imaging orders, SBAR handoff note, meds with contraindications.\n"
            "You do NOT place orders; provider signature required.\n\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            "Return ONLY JSON with:\n"
            "{\n"
            '  "order_bundle": {\n'
            '    "labs": [string],\n'
            '    "imaging": [string],\n'
            '    "cultures": [string]\n'
            "  },\n"
            '  "sbar_note": string,\n'
            '  "med_options": [string],\n'
            '  "contraindications": [string],\n'
            '  "handoff_contract": {\n'
            '    "case_id": string,\n'
            '    "task_type": "order_draft",\n'
            '    "inputs": object,\n'
            '    "constraints": object,\n'
            '    "required_approvals": [string],\n'
            '    "output_artifacts": [string],\n'
            '    "audit_log_ref": string\n'
            "  }\n"
            "}\n"
            "Keep it realistic for urgent symptom workups in general care."
        ),
    },
    "coverage_prior_auth": {
        "name": "Coverage and Prior Auth",
        "description": "Payer rules, benefits verification, prior auth packet",
        "tools": [],
        "instructions": (
            "You are the Coverage and Prior Auth Agent.\n"
            "Assess coverage constraints and documentation needs; do not block urgent care.\n\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            "Return ONLY JSON with:\n"
            "{\n"
            '  "coverage_decision": {\n'
            '    "covered_pathway": string,\n'
            '    "requires_prior_auth": boolean,\n'
            '    "documentation_needed": [string],\n'
            '    "escalation_flags": [string]\n'
            "  },\n"
            '  "handoff_contract": {\n'
            '    "case_id": string,\n'
            '    "task_type": "coverage_check",\n'
            '    "inputs": object,\n'
            '    "constraints": object,\n'
            '    "required_approvals": [string],\n'
            '    "output_artifacts": [string],\n'
            '    "audit_log_ref": string\n'
            "  }\n"
            "}\n"
            "If urgent care is required, note that coverage cannot delay care."
        ),
    },
    "care_coordination": {
        "name": "Care Coordination",
        "description": "Scheduling, logistics, referrals, follow-up, monitoring",
        "tools": [],
        "instructions": (
            "You are the Care Coordination and Monitoring Agent.\n"
            "Schedule urgent visits, coordinate transport, send instructions, set monitoring plan.\n"
            "Escalate clinical changes back to triage.\n\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            "Return ONLY JSON with:\n"
            "{\n"
            '  "coordination_plan": {\n'
            '    "appointments": [string],\n'
            '    "patient_instructions": [string],\n'
            '    "coordination_messages": [string],\n'
            '    "follow_up_timeline": [string],\n'
            '    "monitoring_triggers": [string]\n'
            "  },\n"
            '  "handoff_contract": {\n'
            '    "case_id": string,\n'
            '    "task_type": "scheduling",\n'
            '    "inputs": object,\n'
            '    "constraints": object,\n'
            '    "required_approvals": [string],\n'
            '    "output_artifacts": [string],\n'
            '    "audit_log_ref": string\n'
            "  }\n"
            "}\n"
            "Keep instructions clear and patient-friendly."
        ),
    },
}

DEMO_EHR_CONTEXT = {
    "recent_visit_reason": "Fever and chills reported via patient portal",
    "recent_labs": ["WBC 6.2", "Hgb 12.1", "Platelets 210"],
    "allergies": ["Penicillin (rash)"],
    "comorbidities": ["Type 2 diabetes", "Hypertension"],
    "medication_list": ["Metformin", "Lisinopril"],
}

DEMO_PAYER_CONTEXT = {
    "payer": "Contoso Health Plan",
    "policy_notes": [
        "Urgent care visits covered with documentation",
        "Prior auth required for non-emergency imaging after hours",
        "Peer-to-peer required for inpatient admission without recent labs",
    ],
}


class Agent(BaseAgent):
    """Healthcare handoff workflow orchestrator."""

    def __init__(self, state_store: Dict[str, Any], session_id: str, access_token: str | None = None) -> None:
        super().__init__(state_store, session_id)
        self._access_token = access_token
        self._ws_manager = None
        self._agents: Dict[str, ChatAgent] = {}
        self._threads: Dict[str, Any] = {}
        self._initialized = False
        self._turn_key = f"{session_id}_healthcare_turn"
        self._current_turn = int(state_store.get(self._turn_key, 0))
        self._lab_mode = os.getenv("HEALTHCARE_LAB_MODE", "demo").lower()
        self._brand = os.getenv("HEALTHCARE_LAB_BRAND", "CarePath")

    def set_websocket_manager(self, manager: Any) -> None:
        self._ws_manager = manager

    async def _setup_agents(self) -> None:
        if self._initialized:
            return

        if not all([self.azure_openai_key, self.azure_deployment, self.azure_openai_endpoint, self.api_version]):
            raise RuntimeError(
                "Azure OpenAI configuration is incomplete. Ensure AZURE_OPENAI_API_KEY, "
                "AZURE_OPENAI_CHAT_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_API_VERSION are set."
            )

        headers = self._build_headers()
        base_mcp_tool = await self._create_mcp_tool(headers)

        if base_mcp_tool:
            await base_mcp_tool.__aenter__()
            logger.info("[HEALTHCARE] Connected to MCP server, loaded %s tools", len(base_mcp_tool.functions))

        chat_client = AzureOpenAIChatClient(
            api_key=self.azure_openai_key,
            deployment_name=self.azure_deployment,
            endpoint=self.azure_openai_endpoint,
            api_version=self.api_version,
        )

        for agent_id, config in AGENT_DEFINITIONS.items():
            agent_kwargs: Dict[str, Any] = {
                "name": agent_id,
                "description": config["description"],
                "instructions": config["instructions"],
                "chat_client": chat_client,
                "model": self.openai_model_name,
            }

            agent = ChatAgent(**agent_kwargs)
            await agent.__aenter__()
            self._agents[agent_id] = agent

            thread_state_key = f"{self.session_id}_thread_{agent_id}"
            thread_state = self.state_store.get(thread_state_key)
            if thread_state:
                self._threads[agent_id] = await agent.deserialize_thread(thread_state)
            else:
                self._threads[agent_id] = agent.get_new_thread()

        self._initialized = True
        logger.info("[HEALTHCARE] Initialized %s agents", len(self._agents))

    def _build_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return headers

    async def _create_mcp_tool(self, headers: Dict[str, str]) -> MCPStreamableHTTPTool | None:
        if not self.mcp_server_uri:
            return None

        return MCPStreamableHTTPTool(
            name="mcp-streamable",
            url=self.mcp_server_uri,
            headers=headers,
            timeout=30,
            request_timeout=30,
        )

    async def _emit_orchestrator(self, kind: str, content: str) -> None:
        if not self._ws_manager:
            return
        await self._ws_manager.broadcast(self.session_id, {"type": "orchestrator", "kind": kind, "content": content})

    async def _run_agent_step(
        self,
        agent_id: str,
        prompt: str,
        *,
        show_message_in_internal_process: bool = True,
    ) -> str:
        agent = self._agents[agent_id]
        thread = self._threads[agent_id]
        agent_name = AGENT_DEFINITIONS[agent_id]["name"]

        if self._ws_manager:
            await self._ws_manager.broadcast(
                self.session_id,
                {
                    "type": "agent_start",
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "show_message_in_internal_process": show_message_in_internal_process,
                },
            )

        full_response: List[str] = []
        async for chunk in agent.run_stream(prompt, thread=thread):
            if hasattr(chunk, "contents") and chunk.contents:
                for content in chunk.contents:
                    if getattr(content, "type", None) == "function_call":
                        if self._ws_manager:
                            await self._ws_manager.broadcast(
                                self.session_id,
                                {
                                    "type": "tool_called",
                                    "agent_id": agent_id,
                                    "tool_name": content.name,
                                    "turn": self._current_turn,
                                },
                            )

            if hasattr(chunk, "text") and chunk.text:
                full_response.append(chunk.text)
                if self._ws_manager:
                    await self._ws_manager.broadcast(
                        self.session_id,
                        {
                            "type": "agent_token",
                            "agent_id": agent_id,
                            "content": chunk.text,
                        },
                    )

        response_text = "".join(full_response)

        if self._ws_manager:
            await self._ws_manager.broadcast(
                self.session_id,
                {
                    "type": "agent_message",
                    "agent_id": agent_id,
                    "content": response_text,
                },
            )

        thread_state_key = f"{self.session_id}_thread_{agent_id}"
        self.state_store[thread_state_key] = await thread.serialize()

        return response_text

    @staticmethod
    def _extract_json(text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None

        json_candidate = None
        if "```" in text:
            fence_start = text.find("```")
            fence_end = text.rfind("```")
            if fence_end > fence_start:
                json_candidate = text[fence_start + 3 : fence_end].strip()
                if json_candidate.startswith("json"):
                    json_candidate = json_candidate[4:].strip()
        if not json_candidate:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                json_candidate = text[start : end + 1]

        if not json_candidate:
            return None

        try:
            parsed = json.loads(json_candidate)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    def _build_case_id(self) -> str:
        return f"HC-{self.session_id[:8]}-{self._current_turn}"

    def _build_constraints(self) -> Dict[str, Any]:
        return {
            "urgency_window": "2 hours",
            "decision_rights": "Human signoff required for clinical disposition",
            "mode": self._lab_mode,
        }

    def _ehr_context(self) -> Dict[str, Any]:
        if self._lab_mode == "demo":
            return DEMO_EHR_CONTEXT
        return {
            "recent_visit_reason": "Not connected",
            "recent_labs": [],
            "allergies": [],
            "comorbidities": [],
            "medication_list": [],
        }

    def _payer_context(self) -> Dict[str, Any]:
        if self._lab_mode == "demo":
            return DEMO_PAYER_CONTEXT
        return {"payer": "Not connected", "policy_notes": []}

    def _triage_prompt(self, case_id: str, constraints: Dict[str, Any], intake_payload: Dict[str, Any]) -> str:
        return (
            f"Case: {case_id}\n"
            f"EHR context: {json.dumps(self._ehr_context())}\n"
            f"Symptom report: {json.dumps(intake_payload.get('symptom_report', {}))}\n"
            f"Risk flags: {json.dumps(intake_payload.get('risk_flags', []))}\n"
            f"Constraints: {json.dumps(constraints)}\n"
            "Return triage JSON only."
        )

    def _diagnostics_prompt(self, case_id: str, triage_payload: Dict[str, Any]) -> str:
        return (
            f"Case: {case_id}\n"
            f"Triage assessment: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
            f"EHR context: {json.dumps(self._ehr_context())}\n"
            "Return diagnostics/order JSON only."
        )

    def _coverage_prompt(
        self, case_id: str, triage_payload: Dict[str, Any], diagnostics_payload: Dict[str, Any]
    ) -> str:
        return (
            f"Case: {case_id}\n"
            f"Triage assessment: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
            f"Order bundle: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
            f"Payer context: {json.dumps(self._payer_context())}\n"
            "Return coverage JSON only."
        )

    def _coordination_prompt(
        self, case_id: str, triage_payload: Dict[str, Any], diagnostics_payload: Dict[str, Any], coverage_payload: Dict[str, Any]
    ) -> str:
        return (
            f"Case: {case_id}\n"
            f"Triage assessment: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
            f"Order bundle: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
            f"Coverage decision: {json.dumps(coverage_payload.get('coverage_decision', {}))}\n"
            "Return coordination JSON only."
        )

    async def _run_sequential(
        self, case_id: str, constraints: Dict[str, Any], intake_payload: Dict[str, Any]
    ) -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        await self._emit_orchestrator("progress", f"Intake complete for {case_id}. Handing off to Clinical Triage.")
        triage_text = await self._run_agent_step("clinical_triage", self._triage_prompt(case_id, constraints, intake_payload))
        triage_payload = self._extract_json(triage_text) or {}

        await self._emit_orchestrator("progress", f"Triage proposal ready. Drafting diagnostics and orders for {case_id}.")
        diagnostics_text = await self._run_agent_step("diagnostics_orders", self._diagnostics_prompt(case_id, triage_payload))
        diagnostics_payload = self._extract_json(diagnostics_text) or {}

        await self._emit_orchestrator("progress", f"Order draft complete. Checking coverage and prior auth for {case_id}.")
        coverage_text = await self._run_agent_step(
            "coverage_prior_auth", self._coverage_prompt(case_id, triage_payload, diagnostics_payload)
        )
        coverage_payload = self._extract_json(coverage_text) or {}

        await self._handle_documentation_addendum(case_id, diagnostics_payload, coverage_payload)

        await self._emit_orchestrator("progress", f"Routing to Care Coordination for {case_id}.")
        coordination_text = await self._run_agent_step(
            "care_coordination", self._coordination_prompt(case_id, triage_payload, diagnostics_payload, coverage_payload)
        )
        coordination_payload = self._extract_json(coordination_text) or {}

        return triage_payload, diagnostics_payload, coverage_payload, coordination_payload

    async def _run_fanout_fanin(
        self, case_id: str, constraints: Dict[str, Any], intake_payload: Dict[str, Any]
    ) -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        await self._emit_orchestrator("progress", f"Intake complete for {case_id}. Starting triage.")
        triage_text = await self._run_agent_step("clinical_triage", self._triage_prompt(case_id, constraints, intake_payload))
        triage_payload = self._extract_json(triage_text) or {}

        await self._emit_orchestrator("notice", f"Fan-out: diagnostics, coverage, and coordination planning in parallel.")
        diagnostics_task = self._run_agent_step("diagnostics_orders", self._diagnostics_prompt(case_id, triage_payload))
        coverage_task = self._run_agent_step(
            "coverage_prior_auth", self._coverage_prompt(case_id, triage_payload, {"order_bundle": {}})
        )
        coordination_task = self._run_agent_step(
            "care_coordination",
            (
                f"Case: {case_id}\n"
                f"Triage assessment: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
                "Draft a provisional coordination plan (scheduling + instructions) without waiting on orders.\n"
                "Return coordination JSON only."
            ),
        )

        diagnostics_text, coverage_text, coordination_text = await asyncio.gather(
            diagnostics_task, coverage_task, coordination_task
        )
        diagnostics_payload = self._extract_json(diagnostics_text) or {}
        coverage_payload = self._extract_json(coverage_text) or {}
        coordination_payload = self._extract_json(coordination_text) or {}

        await self._handle_documentation_addendum(case_id, diagnostics_payload, coverage_payload)

        await self._emit_orchestrator("notice", f"Fan-in: refining coordination with orders + coverage outputs.")
        coordination_refine_text = await self._run_agent_step(
            "care_coordination", self._coordination_prompt(case_id, triage_payload, diagnostics_payload, coverage_payload)
        )
        coordination_refine_payload = self._extract_json(coordination_refine_text) or {}
        coordination_payload.update(coordination_refine_payload or {})

        return triage_payload, diagnostics_payload, coverage_payload, coordination_payload

    async def _run_handoff(
        self, case_id: str, constraints: Dict[str, Any], intake_payload: Dict[str, Any]
    ) -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        await self._emit_orchestrator(
            "notice",
            "Handoff mode: rotating ownership with explicit review loops between agents.",
        )

        triage_text = await self._run_agent_step("clinical_triage", self._triage_prompt(case_id, constraints, intake_payload))
        triage_payload = self._extract_json(triage_text) or {}

        await self._emit_orchestrator("notice", "Handoff: Clinical Triage → Diagnostics & Orders")
        diagnostics_text = await self._run_agent_step("diagnostics_orders", self._diagnostics_prompt(case_id, triage_payload))
        diagnostics_payload = self._extract_json(diagnostics_text) or {}

        await self._emit_orchestrator("notice", "Handoff: Diagnostics & Orders → Clinical Triage (review loop)")
        triage_review_prompt = (
            f"Case: {case_id}\n"
            f"Initial triage: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
            f"Diagnostics draft: {json.dumps(diagnostics_payload)}\n"
            "Review diagnostics and update triage assessment if needed. Return triage JSON only."
        )
        triage_review_text = await self._run_agent_step("clinical_triage", triage_review_prompt)
        triage_review_payload = self._extract_json(triage_review_text) or {}
        if triage_review_payload:
            triage_payload = triage_review_payload

        await self._emit_orchestrator("notice", "Handoff: Clinical Triage → Coverage & Prior Auth")
        coverage_text = await self._run_agent_step(
            "coverage_prior_auth", self._coverage_prompt(case_id, triage_payload, diagnostics_payload)
        )
        coverage_payload = self._extract_json(coverage_text) or {}

        documentation_needed = coverage_payload.get("coverage_decision", {}).get("documentation_needed", [])
        if documentation_needed:
            await self._emit_orchestrator("notice", "Handoff: Coverage → Diagnostics (documentation addendum)")
            addendum_prompt = (
                f"Case: {case_id}\n"
                f"Documentation requested: {json.dumps(documentation_needed)}\n"
                f"Order bundle: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
                "Provide a concise medical necessity addendum in JSON:\n"
                '{ "medical_necessity_addendum": string }'
            )
            addendum_text = await self._run_agent_step("diagnostics_orders", addendum_prompt)
            addendum_payload = self._extract_json(addendum_text) or {}
            coverage_payload["medical_necessity_addendum"] = addendum_payload.get(
                "medical_necessity_addendum",
                addendum_text,
            )

            await self._emit_orchestrator("notice", "Handoff: Diagnostics → Coverage (finalize)")
            coverage_finalize_prompt = (
                f"Case: {case_id}\n"
                f"Triage assessment: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
                f"Order bundle: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
                f"Addendum: {coverage_payload.get('medical_necessity_addendum')}\n"
                f"Payer context: {json.dumps(self._payer_context())}\n"
                "Finalize coverage decision JSON only."
            )
            coverage_finalize_text = await self._run_agent_step("coverage_prior_auth", coverage_finalize_prompt)
            coverage_finalize_payload = self._extract_json(coverage_finalize_text) or {}
            if coverage_finalize_payload:
                coverage_payload.update(coverage_finalize_payload)

        await self._emit_orchestrator("notice", "Handoff: Coverage & Prior Auth → Care Coordination")
        coordination_text = await self._run_agent_step(
            "care_coordination", self._coordination_prompt(case_id, triage_payload, diagnostics_payload, coverage_payload)
        )
        coordination_payload = self._extract_json(coordination_text) or {}

        await self._emit_orchestrator("notice", "Handoff loop: Care Coordination → Patient Companion (close the loop)")
        followup_prompt = (
            f"Case: {case_id}\n"
            f"Coordination plan: {json.dumps(coordination_payload.get('coordination_plan', {}))}\n"
            "Draft patient-friendly follow-up messaging and monitoring schedule.\n"
            "Return JSON: {\"follow_up_message\": string, \"monitoring_triggers\": [string]}"
        )
        followup_text = await self._run_agent_step("patient_companion", followup_prompt, show_message_in_internal_process=False)
        followup_payload = self._extract_json(followup_text) or {}
        coordination_payload["follow_up_message"] = followup_payload.get("follow_up_message")

        return triage_payload, diagnostics_payload, coverage_payload, coordination_payload

    async def _handle_documentation_addendum(
        self, case_id: str, diagnostics_payload: Dict[str, Any], coverage_payload: Dict[str, Any]
    ) -> None:
        documentation_needed = coverage_payload.get("coverage_decision", {}).get("documentation_needed", [])
        if not documentation_needed:
            return

        await self._emit_orchestrator("notice", "Coverage requires documentation. Generating medical necessity addendum.")
        addendum_prompt = (
            f"Case: {case_id}\n"
            f"Documentation requested: {json.dumps(documentation_needed)}\n"
            f"Order bundle: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
            "Provide a concise medical necessity addendum in JSON:\n"
            '{ "medical_necessity_addendum": string }'
        )
        addendum_text = await self._run_agent_step("diagnostics_orders", addendum_prompt)
        addendum_payload = self._extract_json(addendum_text) or {}
        coverage_payload["medical_necessity_addendum"] = addendum_payload.get(
            "medical_necessity_addendum",
            addendum_text,
        )

    async def _run_magentic(
        self, case_id: str, constraints: Dict[str, Any], intake_payload: Dict[str, Any], prompt: str
    ) -> str:
        try:
            from agent_framework import (
                MagenticBuilder,
                WorkflowOutputEvent,
                MagenticCallbackMode,
                MagenticOrchestratorMessageEvent,
                MagenticAgentDeltaEvent,
                MagenticAgentMessageEvent,
                MagenticFinalResultEvent,
            )
        except Exception:
            return (
                "Magentic orchestration is not available in this Agent Framework version. "
                "Please install a version that includes MagenticBuilder."
            )

        await self._emit_orchestrator(
            "notice", f"Magentic mode: manager coordinating 5 specialists for {case_id}."
        )

        manager_instructions = (
            "You are the CarePath orchestration manager.\n"
            "Coordinate the five specialists to deliver a concise patient-facing update.\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated by the patient.\n"
            "Return the final response with Markdown headings and bullet points."
        )

        participants: Dict[str, ChatAgent] = {}
        for agent_id, config in AGENT_DEFINITIONS.items():
            participants[agent_id] = self._agents[agent_id]

        builder = MagenticBuilder().participants(**participants)

        if self._ws_manager:
            async def _stream_event(event: Any) -> None:
                if isinstance(event, MagenticOrchestratorMessageEvent):
                    msg = getattr(event.message, "text", "") if event.message else ""
                    await self._emit_orchestrator(event.kind, msg)
                elif isinstance(event, MagenticAgentDeltaEvent):
                    if event.text:
                        await self._ws_manager.broadcast(
                            self.session_id,
                            {"type": "agent_token", "agent_id": event.agent_id, "content": event.text},
                        )
                elif isinstance(event, MagenticAgentMessageEvent):
                    msg = getattr(event.message, "text", "") if event.message else ""
                    await self._ws_manager.broadcast(
                        self.session_id, {"type": "agent_message", "agent_id": event.agent_id, "content": msg}
                    )
                elif isinstance(event, MagenticFinalResultEvent):
                    msg = getattr(event.message, "text", "") if event.message else ""
                    await self._ws_manager.broadcast(
                        self.session_id, {"type": "final_result", "content": msg}
                    )

            builder = builder.on_event(_stream_event, mode=MagenticCallbackMode.STREAMING)

        manager_agent = ChatAgent(
            name="magentic_manager",
            chat_client=AzureOpenAIChatClient(
                api_key=self.azure_openai_key,
                deployment_name=self.azure_deployment,
                endpoint=self.azure_openai_endpoint,
                api_version=self.api_version,
            ),
            instructions=manager_instructions,
            model=self.openai_model_name,
        )
        await manager_agent.__aenter__()

        workflow = builder.with_standard_manager(
            agent=manager_agent,
            max_round_count=4,
        ).build()

        task = (
            f"Case: {case_id}\n"
            f"Patient statement: {prompt}\n"
            f"Intake: {json.dumps(intake_payload.get('symptom_report', {}))}\n"
            f"EHR context: {json.dumps(self._ehr_context())}\n"
            f"Constraints: {json.dumps(constraints)}\n"
            "Provide a structured patient update with headings and bullets."
        )

        final_answer: Optional[str] = None
        async for event in workflow.run_stream(task):
            if isinstance(event, WorkflowOutputEvent):
                data = event.data
                final_answer = getattr(data, "text", None) if hasattr(data, "text") else str(data)

        return final_answer or "The Magentic workflow did not return a final response."

    async def chat_async(self, prompt: str) -> str:
        await self._setup_agents()
        self._current_turn += 1
        self.state_store[self._turn_key] = self._current_turn

        pattern = self.state_store.get(f"{self.session_id}_pattern", "sequential")

        case_id = self._build_case_id()
        timestamp = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        constraints = self._build_constraints()

        await self._emit_orchestrator("user_task", f"Case {case_id} intake received at {timestamp}.")

        intake_prompt = (
            f"You are running intake for case_id={case_id} at {timestamp}.\n"
            f"Patient statement: {prompt}\n"
            f"Brand: {self._brand}\n"
            f"Constraints: {json.dumps(constraints)}\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            "Produce the intake JSON now."
        )
        intake_text = await self._run_agent_step("patient_companion", intake_prompt)
        intake_payload = self._extract_json(intake_text) or {}

        if pattern == "sequential":
            triage_payload, diagnostics_payload, coverage_payload, coordination_payload = await self._run_sequential(
                case_id, constraints, intake_payload
            )
        elif pattern == "fanout_fanin":
            triage_payload, diagnostics_payload, coverage_payload, coordination_payload = await self._run_fanout_fanin(
                case_id, constraints, intake_payload
            )
        elif pattern == "handoff":
            triage_payload, diagnostics_payload, coverage_payload, coordination_payload = await self._run_handoff(
                case_id, constraints, intake_payload
            )
        elif pattern == "magentic":
            await self._emit_orchestrator("notice", "Magentic pattern is disabled in this demo. Using Sequential.")
            triage_payload, diagnostics_payload, coverage_payload, coordination_payload = await self._run_sequential(
                case_id, constraints, intake_payload
            )
        else:
            triage_payload, diagnostics_payload, coverage_payload, coordination_payload = await self._run_sequential(
                case_id, constraints, intake_payload
            )

        await self._emit_orchestrator("result", f"Workflow assembled for {case_id}. Preparing patient-facing summary.")

        final_prompt = (
            f"Compose a patient-facing update for case {case_id}.\n"
            "Format as concise Markdown with clear sections and bullet points.\n"
            "Required sections (use ### headings):\n"
            "### Summary\n"
            "### Safety Disclaimer\n"
            "### Immediate Next Steps\n"
            "### Questions For You\n"
            "### What We've Prepared\n"
            "### When To Re-Contact\n"
            "Do NOT assume oncology or chemotherapy unless explicitly stated.\n"
            f"Triage: {json.dumps(triage_payload.get('triage_assessment', {}))}\n"
            f"Orders: {json.dumps(diagnostics_payload.get('order_bundle', {}))}\n"
            f"Coverage: {json.dumps(coverage_payload.get('coverage_decision', {}))}\n"
            f"Coordination: {json.dumps(coordination_payload.get('coordination_plan', {}))}\n"
            f"Questions: {json.dumps(intake_payload.get('questions_for_patient', []))}\n"
            "Use bullet points where helpful. Keep sentences short and readable."
        )
        final_response = await self._run_agent_step("patient_companion", final_prompt, show_message_in_internal_process=False)

        if self._ws_manager:
            await self._ws_manager.broadcast(self.session_id, {"type": "final_result", "content": final_response})

        self.append_to_chat_history(
            [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": final_response},
            ]
        )

        self.state_store[f"{self.session_id}_last_case"] = {
            "case_id": case_id,
            "intake": intake_payload,
            "triage": triage_payload,
            "diagnostics": diagnostics_payload,
            "coverage": coverage_payload,
            "coordination": coordination_payload,
        }

        self._setstate({"mode": "healthcare_handoff", "case_id": case_id})

        return final_response
