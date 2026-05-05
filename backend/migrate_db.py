import sqlite3
import random

def get_insights_for_industry(industry):
    ind = industry.lower()
    
    if 'health' in ind or 'medical' in ind or 'hospital' in ind or 'pharma' in ind:
        problems = [
            "TARGET DEPARTMENT: Surgical Training & Clinical Operations\n\n"
            "BACKGROUND: The institution relies heavily on physical cadaveric labs and direct observational learning for complex surgical procedures.\n\n"
            "CURRENT BOTTLENECK: Scheduling conflicts and high procurement costs of anatomical models limit the frequency of hands-on practice. Furthermore, rare complications cannot be safely replicated in real-time training environments.\n\n"
            "BUSINESS IMPACT: Slower onboarding of junior surgeons, increased liability risks during initial live procedures, and high continuous operational overhead for medical training facilities.",
            
            "TARGET DEPARTMENT: Patient Rehabilitation & Physical Therapy\n\n"
            "BACKGROUND: Post-operative recovery relies on repetitive, unguided physical exercises at home or in clinical settings.\n\n"
            "CURRENT BOTTLENECK: Patients suffer from severe motivation drops and poor form compliance when completing exercises without direct supervision, leading to plateaued recovery curves.\n\n"
            "BUSINESS IMPACT: Extended hospital readmission rates, poor patient satisfaction metrics, and inefficient use of clinical hours for routine physical therapy follow-ups."
        ]
        solutions = [
            "FY INTECH ARCHITECTURE: Immersive VR Surgical Digital Twin\n\n"
            "IMPLEMENTATION: We will deploy a networked Virtual Reality (VR) surgical simulation platform powered by Unreal Engine 5. This system will ingest the hospital's MRI/CT scan data to generate 1:1 patient-specific interactive 3D models.\n\n"
            "EXECUTION: Surgeons can utilize haptic-feedback controllers to perform 'dry runs' of complex cardiovascular or neurological surgeries. The system tracks precision metrics down to the millimeter.\n\n"
            "PROJECTED ROI: 40% reduction in training facility costs, 25% faster procedural mastery for residents, and near-zero liability exposure during the training phase.",
            
            "FY INTECH ARCHITECTURE: Gamified Mixed Reality (MR) Recovery System\n\n"
            "IMPLEMENTATION: We will provision MR headsets equipped with spatial mapping and real-time skeletal tracking. The software overlays gamified interactive elements over the patient's physical living room.\n\n"
            "EXECUTION: As patients perform prescribed ranges of motion, the system provides immediate visual feedback on their form and beams kinematic data directly back to the attending physician's dashboard.\n\n"
            "PROJECTED ROI: 60% increase in home-exercise compliance, significantly reduced clinical follow-up hours, and an elevated, modern patient care experience."
        ]
        
    elif 'oil' in ind or 'energy' in ind or 'manufacturing' in ind or 'engineering' in ind or 'construction' in ind:
        problems = [
            "TARGET DEPARTMENT: Offshore Operations & Field Maintenance\n\n"
            "BACKGROUND: Technicians are deployed to remote, hazardous offshore rigs or sprawling refineries to conduct preventative maintenance and emergency repairs on highly complex, proprietary turbine machinery.\n\n"
            "CURRENT BOTTLENECK: When unpredictable mechanical failures occur, junior technicians rely on thick physical manuals or low-bandwidth voice calls to central engineering hubs, leading to severe diagnostic delays.\n\n"
            "BUSINESS IMPACT: Prolonged operational downtime costing upwards of $200,000 per hour, coupled with heightened occupational safety risks during complex disassemblies.",
            
            "TARGET DEPARTMENT: Industrial Design & Spatial Planning\n\n"
            "BACKGROUND: The engineering division develops massive, multi-million dollar HVAC and piping layouts for industrial plants using flat 2D CAD drawings or non-interactive 3D desktop software.\n\n"
            "CURRENT BOTTLENECK: Spatial conflicts (clashes) between structural frameworks and mechanical systems are often not discovered until physical construction begins on-site.\n\n"
            "BUSINESS IMPACT: Expensive mid-construction change orders, severe timeline delays, and material waste resulting from structural rework."
        ]
        solutions = [
            "FY INTECH ARCHITECTURE: Remote AR Expert Overlay System\n\n"
            "IMPLEMENTATION: We will equip field engineers with industrial-grade Augmented Reality (AR) smart glasses integrated seamlessly into their hardhats. The system connects via satellite or 5G to the centralized engineering database.\n\n"
            "EXECUTION: When a field worker looks at a malfunctioning turbine, the AR glasses use object recognition to overlay digital schematics, live IoT sensor data, and step-by-step repair holograms directly onto the physical machine. Senior engineers at HQ can see through the worker's eyes and draw spatial annotations in real-time.\n\n"
            "PROJECTED ROI: 35% reduction in mean-time-to-repair (MTTR), elimination of emergency senior staff travel costs, and dramatically improved field safety compliance.",
            
            "FY INTECH ARCHITECTURE: 1:1 Scale XR Digital Twin Walkthrough\n\n"
            "IMPLEMENTATION: We will deploy an Extended Reality (XR) spatial computing platform that translates standard CAD/BIM files into fully explorable, hyper-realistic multi-user environments.\n\n"
            "EXECUTION: Stakeholders and engineering leads can put on XR headsets and physically walk through the proposed factory layout at 1:1 scale before a single piece of steel is cut. They can identify spatial bottlenecks and ergonomic hazards collaboratively in the virtual space.\n\n"
            "PROJECTED ROI: Virtual elimination of late-stage spatial clashes, saving an average of 15% on total raw material budgets and accelerating project approval timelines."
        ]
        
    elif 'aviation' in ind or 'logistics' in ind or 'supply' in ind or 'freight' in ind or 'airline' in ind:
        problems = [
            "TARGET DEPARTMENT: Global Fleet Logistics & Supply Chain Command\n\n"
            "BACKGROUND: Regional managers rely on fragmented 2D dashboards, delayed spreadsheet reports, and legacy tracking systems to monitor global cargo routes and vehicle telemetry.\n\n"
            "CURRENT BOTTLENECK: When a geopolitical event or weather anomaly occurs, managers struggle to rapidly visualize the compounding effect on global supply lines because the data is siloed across different flat interfaces.\n\n"
            "BUSINESS IMPACT: Inefficient rerouting decisions, millions lost in expired or delayed freight, and an inability to proactively manage fleet bottlenecks.",
            
            "TARGET DEPARTMENT: Aircraft Maintenance & Crew Training\n\n"
            "BACKGROUND: Airline technicians must memorize the intricate wiring and hydraulic systems of specific aircraft models (e.g., Boeing 777, Airbus A350) prior to live maintenance.\n\n"
            "CURRENT BOTTLENECK: Physical aircraft cannot be grounded solely for training purposes without incurring massive revenue losses. Traditional classroom learning fails to build spatial memory.\n\n"
            "BUSINESS IMPACT: Slower training pipelines, higher risk of maintenance errors leading to delayed flights, and massive capital tied up in dedicated training facilities."
        ]
        solutions = [
            "FY INTECH ARCHITECTURE: Holographic XR Command Center\n\n"
            "IMPLEMENTATION: We will construct a bespoke Mixed Reality (MR) tactical table application for executive operations teams. Using spatial computing headsets, managers will interact with a live, 3D holographic globe hovering in their boardroom.\n\n"
            "EXECUTION: The XR application will ingest real-time API telemetry from cargo ships, planes, and weather buoys. Executives can literally 'grab' a shipping route and physically drag it to visualize rerouting analytics instantly.\n\n"
            "PROJECTED ROI: Unprecedented situational awareness leading to a 20% improvement in crisis-rerouting efficiency, establishing the company as a technologically dominant industry leader.",
            
            "FY INTECH ARCHITECTURE: VR Spatial Aircraft Mechanics Simulator\n\n"
            "IMPLEMENTATION: We will deliver a highly optimized Virtual Reality (VR) training environment featuring physically accurate, interactable models of commercial aircraft engines and hydraulic systems.\n\n"
            "EXECUTION: Technicians can repeatedly practice tearing down and reassembling a virtual jet engine. The system requires them to use the correct virtual tools and follow safety checklists strictly, enforcing spatial muscle memory.\n\n"
            "PROJECTED ROI: Zero fleet grounding required for training, 50% reduction in technician certification time, and significantly reduced risk of critical mechanical failures in the field."
        ]
        
    else:
        # Corporate, Finance, Technology, Retail, etc.
        problems = [
            "TARGET DEPARTMENT: Enterprise B2B Sales & Marketing\n\n"
            "BACKGROUND: The sales team is tasked with pitching massive, highly customized, million-dollar equipment or enterprise software architectures to C-suite executives globally.\n\n"
            "CURRENT BOTTLENECK: Pitching relies on static PowerPoint decks and prerecorded videos. Executives struggle to visualize the actual scale, integration, and impact of the product within their specific corporate environment.\n\n"
            "BUSINESS IMPACT: Prolonged sales cycles (12-18 months), lower conversion rates due to lack of buyer conviction, and exorbitant costs associated with flying executives to physical showrooms.",
            
            "TARGET DEPARTMENT: Human Resources & Global Onboarding\n\n"
            "BACKGROUND: The company is rapidly scaling, hiring hundreds of remote employees across different time zones who never set foot in the corporate headquarters.\n\n"
            "CURRENT BOTTLENECK: The onboarding process consists of disjointed Zoom calls and reading PDF manuals. Remote employees feel disconnected from the company culture and struggle to understand the physical operational scale of the business.\n\n"
            "BUSINESS IMPACT: High first-year employee churn rates, lower baseline productivity during the first 6 months, and weak corporate culture alignment."
        ]
        solutions = [
            "FY INTECH ARCHITECTURE: AR Immersive Sales Catalog\n\n"
            "IMPLEMENTATION: We will develop a bespoke Augmented Reality (AR) application for the sales team's iPads and spatial computing devices. The app transforms abstract data sheets into interactive, photorealistic 3D holograms.\n\n"
            "EXECUTION: During a boardroom pitch, the sales rep can project a highly detailed, animated 3D model of your product directly onto the client's conference table. The client can physically walk around the hologram, interact with its components, and instantly visualize its value.\n\n"
            "PROJECTED ROI: Shortened enterprise sales cycles by up to 30%, significantly higher pitch engagement, and the complete elimination of physical prototype shipping costs.",
            
            "FY INTECH ARCHITECTURE: The VR Corporate Metaverse Campus\n\n"
            "IMPLEMENTATION: We will architect a secure, private Virtual Reality (VR) campus that serves as an exact digital twin of your flagship global headquarters, running securely on standalone VR headsets.\n\n"
            "EXECUTION: On day one, new remote hires receive a VR headset. They enter the digital HQ, interact with the CEO's avatar for a live welcome speech, participate in interactive scavenger hunts to learn company history, and collaborate with other global hires in spatial audio break-out rooms.\n\n"
            "PROJECTED ROI: 40% increase in new hire retention, deeply ingrained corporate culture regardless of geographical location, and a modern, forward-thinking employer brand image."
        ]
    
    return random.choice(problems), random.choice(solutions)

def run_migration():
    print("Connecting to crm.db...")
    conn = sqlite3.connect("crm.db")
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE leads ADD COLUMN problem TEXT")
        cursor.execute("ALTER TABLE leads ADD COLUMN solution TEXT")
    except sqlite3.OperationalError:
        pass

    cursor.execute("SELECT id, industry FROM leads")
    leads = cursor.fetchall()

    print(f"Generating ENTERPRISE-GRADE XR/VR/AR/MR insights for {len(leads)} leads...")
    
    for lead_id, industry in leads:
        industry_str = str(industry) if industry else ""
        problem, solution = get_insights_for_industry(industry_str)
        
        cursor.execute(
            "UPDATE leads SET problem = ?, solution = ? WHERE id = ?",
            (problem, solution, lead_id)
        )

    conn.commit()
    conn.close()
    print("Migration complete! Enterprise database updated.")

if __name__ == "__main__":
    run_migration()
