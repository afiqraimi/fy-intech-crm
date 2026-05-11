"""
One-time script to populate problem & solution fields for all leads
based on their industry, tailored to FY Intech Solution Sdn Bhd's VR services.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import Lead

# ─── Industry → (Problem, Solution) mapping ────────────────────────────────────
INDUSTRY_MAP = {
    "airlines/aviation": (
        "Lack of immersive, cost-effective crew training and safety drill simulations for ground and flight personnel. Conventional training requires grounding aircraft and incurs high logistical costs.",
        "FY Intech provides immersive VR-based cabin crew and pilot training simulations, enabling realistic emergency drills, aircraft familiarization, and maintenance procedure training without grounding actual aircraft — reducing costs by up to 60% while improving safety readiness.",
    ),
    "aviation & aerospace": (
        "Expensive and logistically complex manufacturing training and design review processes for aerospace components. Physical mockups are costly and slow to iterate.",
        "FY Intech develops VR aerospace manufacturing and design review simulations that enable engineers to collaboratively inspect 3D models at full scale, accelerating design cycles and reducing physical prototyping costs.",
    ),
    "oil & energy": (
        "High-risk on-site safety training for offshore platform and refinery workers. Real-world emergency drills are expensive, infrequent, and cannot safely replicate catastrophic scenarios.",
        "FY Intech deploys VR-powered offshore platform and refinery safety simulations, allowing workers to practice emergency response, equipment handling, and hazard recognition in a zero-risk virtual environment — improving safety compliance and reducing incident rates.",
    ),
    "construction": (
        "Ineffective stakeholder visualization of architectural designs leading to miscommunication, approval delays, and costly rework during construction phases.",
        "FY Intech delivers VR architectural walkthroughs and construction sequencing simulations, enabling real-time design review and clash detection before breaking ground — saving thousands in rework costs.",
    ),
    "information technology & services": (
        "Difficulty in demonstrating complex IT infrastructure, data center operations, and software solutions to non-technical clients and stakeholders.",
        "FY Intech creates interactive VR product demonstrations and data center walkthroughs that translate complex IT solutions into immersive, easy-to-understand experiences for decision-makers.",
    ),
    "information services": (
        "Difficulty in demonstrating complex IT infrastructure and data management solutions to non-technical clients and stakeholders.",
        "FY Intech creates interactive VR product demonstrations and data center walkthroughs that translate complex information services into immersive, easy-to-understand experiences for decision-makers.",
    ),
    "medical devices": (
        "Limited hands-on product training opportunities for surgeons and clinicians before device deployment. Physical training requires expensive equipment, cadavers, or live procedures.",
        "FY Intech designs VR-based medical device operation simulations, enabling surgeons and clinicians to practice device handling and procedures in a risk-free virtual environment — accelerating adoption and improving patient outcomes.",
    ),
    "hospital & health care": (
        "Insufficient immersive training for medical staff on complex procedures, emergency response, and patient empathy scenarios. Traditional methods lack realism and scalability.",
        "FY Intech builds VR healthcare training modules for surgical procedure simulation, patient interaction scenarios, and hospital emergency response drills — enhancing staff competency and patient care quality.",
    ),
    "logistics & supply chain": (
        "Inefficient warehouse layout planning, safety protocol training, and supply chain process visualization. Traditional training methods are paper-based and ineffective for spatial understanding.",
        "FY Intech provides VR warehouse simulation solutions for layout optimization, forklift safety training, and supply chain process visualization — reducing training time by 40% and improving operational safety.",
    ),
    "telecommunications": (
        "Challenging tower inspection training and network infrastructure visualization for field engineers. On-site training is hazardous and logistically complex.",
        "FY Intech offers VR-based telecom tower inspection simulations and network infrastructure walkthroughs for safer, more effective field engineer training without physical risk exposure.",
    ),
    "staffing & recruiting": (
        "Difficulty in assessing candidate practical skills and providing immersive employer branding experiences during recruitment. Traditional interviews fail to evaluate hands-on competencies.",
        "FY Intech develops VR-based job simulation assessments and virtual office tours that enhance candidate evaluation accuracy and employer brand perception in a competitive talent market.",
    ),
    "property developer": (
        "Limited ability to showcase unbuilt properties to potential buyers and investors. Traditional brochures and 2D renders fail to convey spatial experience and emotional connection.",
        "FY Intech creates photorealistic VR property tours and interactive showroom experiences, allowing buyers to explore properties before construction begins — increasing pre-sales conversion by up to 30%.",
    ),
    "real estate": (
        "Limited ability to showcase unbuilt properties and interiors to potential buyers and investors. Traditional brochures and 2D renders fail to convey spatial experience and emotional connection.",
        "FY Intech creates photorealistic VR property tours and interactive showroom experiences, allowing buyers to explore properties before construction begins — increasing pre-sales conversion by up to 30%.",
    ),
    "local council": (
        "Ineffective public engagement for urban planning proposals and smart city initiatives. Static presentations fail to convey the true impact of development projects to citizens.",
        "FY Intech builds VR urban planning and smart city simulation platforms that enable councils to present development proposals to citizens in an immersive, accessible format — improving public participation and approval rates.",
    ),
    "government administration": (
        "Ineffective public engagement for policy proposals, infrastructure projects, and citizen services. Traditional town halls and printed materials fail to reach younger demographics.",
        "FY Intech builds VR urban planning and smart city simulation platforms that enable government agencies to present proposals to citizens in an immersive, accessible format — improving public participation and approval rates.",
    ),
    "government relations": (
        "Difficulty in visually communicating policy impacts and development plans to diverse stakeholders including legislators, community leaders, and the public.",
        "FY Intech creates VR policy visualization platforms that demonstrate proposed changes and their impacts in an accessible, immersive format — building stakeholder consensus and public trust.",
    ),
    "banking": (
        "Lack of engaging tools for financial data visualization and branch experience innovation. Traditional dashboards overload users with complex spreadsheets and charts.",
        "FY Intech designs VR-based financial data dashboards and virtual branch experiences that transform complex data into intuitive 3D visualizations for faster, better-informed decision-making.",
    ),
    "financial services": (
        "Lack of engaging tools for financial data visualization, client portfolio reviews, and branch experience innovation. Traditional dashboards overload users with complex spreadsheets.",
        "FY Intech designs VR-based financial data dashboards and virtual advisory experiences that transform complex data into intuitive 3D visualizations for faster, better-informed client conversations.",
    ),
    "higher education": (
        "Limited immersive learning tools for technical and vocational subjects. Traditional lectures and textbooks struggle to engage digitally-native students and convey 3D concepts.",
        "FY Intech delivers VR classroom modules and virtual laboratory simulations, enabling students to conduct experiments and explore concepts in a fully immersive environment — improving engagement and knowledge retention.",
    ),
    "education management": (
        "Limited immersive learning tools for technical and vocational subjects. Traditional lectures and textbooks struggle to engage digitally-native students and convey complex 3D concepts.",
        "FY Intech delivers VR classroom modules and virtual laboratory simulations, enabling students to conduct experiments and explore concepts in a fully immersive environment — improving engagement and knowledge retention.",
    ),
    "automotive": (
        "Inefficient vehicle design review process requiring expensive physical prototypes, and limited immersive showroom experiences for customers.",
        "FY Intech provides VR automotive design studios and virtual showroom experiences that accelerate design iteration by 50% and enhance customer engagement through interactive 3D vehicle exploration.",
    ),
    "manufacturing": (
        "High training costs and safety risks for assembly line and equipment operation training. Traditional on-the-job training leads to production downtime and safety incidents.",
        "FY Intech creates VR manufacturing training simulations for assembly line procedures, equipment operation, and workplace safety protocols — reducing training costs and minimizing production disruptions.",
    ),
    "electrical/electronic manufacturing": (
        "High training costs and safety risks for electronics assembly, cleanroom operations, and equipment handling. Traditional training methods are slow and error-prone.",
        "FY Intech creates VR electronics manufacturing training simulations for PCB assembly, component handling, and ESD safety protocols — reducing training costs and improving quality control.",
    ),
    "maritime": (
        "Costly and time-consuming ship design reviews and crew safety training. Physical drills at sea are expensive, dangerous, and logistically complex to coordinate.",
        "FY Intech develops VR ship design walkthroughs and maritime safety training simulations that reduce design review cycles and improve crew emergency preparedness without vessel downtime.",
    ),
    "shipbuilding": (
        "Costly and time-consuming ship design reviews and construction planning. Physical mockups are impractical for large vessels, leading to expensive mid-construction changes.",
        "FY Intech develops VR ship design walkthroughs and construction sequencing simulations that enable full-scale 3D review, reducing costly mid-build modifications and accelerating delivery timelines.",
    ),
    "defense & space": (
        "Expensive and logistically complex tactical training and mission simulation exercises. Live exercises consume significant resources and cannot replicate all threat scenarios.",
        "FY Intech builds VR-based tactical training and mission rehearsal simulations that reduce exercise costs by 70% while maintaining training realism and expanding scenario variety.",
    ),
    "pharmaceuticals": (
        "Stringent cleanroom training requirements and complex manufacturing process visualization needs. GMP compliance training is time-consuming and must be repeated frequently.",
        "FY Intech provides VR cleanroom protocol training and pharmaceutical manufacturing process simulations for GMP compliance and staff competency — reducing training time and improving audit readiness.",
    ),
    "hospitality": (
        "Inability to provide immersive virtual previews of hotel facilities, event spaces, and guest experiences to potential clients and travel agents.",
        "FY Intech creates VR hotel tours and event venue walkthroughs, enabling prospective guests and event planners to explore facilities remotely — increasing direct bookings by 25%.",
    ),
    "retail": (
        "Limited ability to test store layouts and visualize merchandising before physical implementation. Planogram errors and poor layouts lead to lost sales and expensive refits.",
        "FY Intech delivers VR retail space planning and virtual merchandising simulations that optimize store design and customer flow — reducing refit costs and improving sales per square foot.",
    ),
    "architecture & planning": (
        "Clients struggle to visualize 2D plans and renders, leading to approval delays and misaligned expectations between architects and stakeholders.",
        "FY Intech provides immersive VR architectural walkthroughs that transform 2D blueprints into fully explorable 3D environments for client presentations — accelerating approvals and reducing revision cycles.",
    ),
    "civil engineering": (
        "Complex infrastructure projects are difficult to communicate to non-technical stakeholders including government bodies, investors, and affected communities.",
        "FY Intech builds VR infrastructure visualization tools that allow civil engineering firms to showcase bridges, highways, and developments in immersive detail — improving stakeholder buy-in.",
    ),
    "design": (
        "Clients struggle to visualize and approve 2D design concepts before production. Flat renders fail to convey spatial relationships and material qualities.",
        "FY Intech provides VR design review environments where clients can walk through and interact with 3D design concepts in real-time — reducing revision cycles by 40%.",
    ),
    "environmental services": (
        "Difficulty in communicating environmental impact assessments and sustainability plans to stakeholders, regulators, and affected communities.",
        "FY Intech creates VR environmental impact simulations that visualize proposed developments and their ecological effects in an immersive format — improving transparency and public trust.",
    ),
    "renewables & environment": (
        "Difficulty communicating renewable energy project benefits and long-term environmental impact to communities, investors, and regulatory bodies.",
        "FY Intech builds VR renewable energy visualization experiences that demonstrate solar farms, wind turbines, and hydro projects to stakeholders in an immersive, compelling format — accelerating project approvals.",
    ),
    "security & investigations": (
        "Limited realistic scenario training for security personnel and crime scene analysis. Tabletop exercises and classroom training fail to replicate real-world pressure and spatial context.",
        "FY Intech develops VR security scenario training and crime scene reconstruction simulations for enhanced investigative skills and rapid threat response capabilities.",
    ),
    "insurance": (
        "Inefficient risk assessment training and claims process visualization for adjusters. Paper-based case studies lack the spatial context needed for accurate property and liability assessments.",
        "FY Intech provides VR-based risk assessment simulations and claims scenario training that improve adjuster accuracy and decision-making through realistic 3D property walkthroughs.",
    ),
    "professional training & coaching": (
        "Low engagement and knowledge retention in conventional corporate training programs. Slide-based e-learning fails to develop practical skills and decision-making abilities.",
        "FY Intech delivers white-label VR corporate training modules with immersive scenarios that boost engagement by 4x and improve knowledge retention by up to 75% compared to traditional methods.",
    ),
    "food & beverages": (
        "Limited ability to showcase production facilities and quality processes to B2B clients, auditors, and retail partners. Physical tours are disruptive to production.",
        "FY Intech creates VR factory tours and production line walkthroughs, enabling food & beverage companies to demonstrate hygiene and quality standards to potential partners without disrupting operations.",
    ),
    "food production": (
        "Limited ability to showcase production facilities and quality processes to B2B clients, auditors, and retail partners. Physical tours are disruptive to food safety protocols.",
        "FY Intech creates VR factory tours and production line walkthroughs, enabling food production companies to demonstrate hygiene and quality standards to potential partners without disrupting operations.",
    ),
    "computer games": (
        "Need for partnership in developing immersive VR gaming content and experiences that stand out in a competitive entertainment market.",
        "FY Intech offers VR game development collaboration, providing expertise in immersive environments, 3D asset optimization, and user experience design for next-generation gaming experiences.",
    ),
    "semiconductors": (
        "High-cost cleanroom training and complex equipment familiarization for technicians. Contamination risks during physical training are unacceptable in semiconductor fabrication.",
        "FY Intech builds VR cleanroom and semiconductor equipment training simulations that reduce training costs by 50% while eliminating contamination risks during technician onboarding.",
    ),
    "events services": (
        "Clients struggle to visualize event layouts, lighting designs, and venue setups before execution, leading to last-minute changes and client dissatisfaction.",
        "FY Intech provides VR event planning and venue visualization tools that allow clients to experience and refine setups before the actual event — reducing changes and improving satisfaction.",
    ),
    "law practice": (
        "Difficulty in presenting complex case reconstructions and forensic evidence to juries, judges, and clients in an understandable format.",
        "FY Intech develops VR crime scene and accident reconstruction simulations that enhance courtroom presentations, improve juror understanding, and strengthen case arguments.",
    ),
    "sports": (
        "Limited tools for athlete performance analysis, tactical training visualization, and fan engagement experiences beyond traditional video and statistics.",
        "FY Intech creates VR sports training and fan experience modules that visualize player movements and provide immersive stadium experiences — enhancing both athlete development and fan loyalty.",
    ),
    "tobacco": (
        "Limited B2B product demonstration and manufacturing process visualization capabilities for international partners and regulatory audits.",
        "FY Intech provides VR-based product line tours and manufacturing process demonstrations for B2B stakeholder engagement — enabling remote quality assurance and partner collaboration.",
    ),
    "farming": (
        "Lack of immersive training tools for precision agriculture techniques, equipment operation, and sustainable farming practices.",
        "FY Intech develops VR precision farming simulations for crop management training, equipment familiarization, and sustainable farming education — improving agricultural productivity and sustainability.",
    ),
    "chemicals": (
        "High-risk chemical handling training and plant safety protocol education needs. Live training with hazardous materials poses unacceptable safety risks to trainees.",
        "FY Intech creates VR chemical plant safety simulations for hazardous material handling, emergency response, and standard operating procedure training — ensuring safety compliance with zero risk.",
    ),
    "venture capital & private equity": (
        "Difficulty evaluating startup products, manufacturing facilities, and physical assets without costly and time-consuming on-site visits across multiple geographies.",
        "FY Intech builds VR due diligence platforms that allow investors to virtually experience portfolio company products, facilities, and prototypes — accelerating investment decisions.",
    ),
    "investment management": (
        "Difficulty in visualizing portfolio data and presenting complex investment theses to clients and investment committees effectively.",
        "FY Intech provides VR financial data visualization platforms that transform portfolio analytics into immersive 3D dashboards — enabling faster, more intuitive investment decision-making.",
    ),
    "market research": (
        "Limited ability to test consumer reactions to physical products, store layouts, and packaging designs before committing to expensive production runs.",
        "FY Intech provides VR consumer research environments where companies can test product placement, packaging, and store design with realistic consumer feedback — reducing go-to-market risk.",
    ),
    "accounting": (
        "Difficulty in presenting complex financial data, audit findings, and forensic accounting results to non-financial stakeholders in an understandable way.",
        "FY Intech creates VR data visualization dashboards that transform complex financial data into intuitive 3D representations for stakeholder presentations and audit reporting.",
    ),
    "luxury goods & jewelry": (
        "Inability to offer immersive virtual try-on and product showcase experiences for remote high-net-worth clients who expect premium, personalized service.",
        "FY Intech develops VR luxury product showrooms and virtual try-on experiences that enable brands to engage high-value clients regardless of location — expanding market reach.",
    ),
    "apparel & fashion": (
        "Limited ability to showcase collections and offer virtual try-on experiences for online shoppers, leading to high return rates and low online conversion.",
        "FY Intech creates VR fashion showrooms and virtual fitting experiences that bridge the gap between online shopping and in-store experience — reducing returns and boosting online sales.",
    ),
    "nonprofit organization management": (
        "Limited tools to communicate social impact and create emotional connections with donors, volunteers, and stakeholders.",
        "FY Intech builds VR impact storytelling experiences that immerse donors in the communities and causes they support — driving empathy, engagement, and fundraising results.",
    ),
    "civic & social organization": (
        "Limited public engagement tools for community initiatives and social programs. Traditional outreach methods fail to reach younger, digitally-native demographics.",
        "FY Intech develops VR community engagement platforms that visualize social impact initiatives for public and donor audiences — increasing participation and support.",
    ),
    "outsourcing/offshoring": (
        "Difficulty in showcasing operational capabilities, facility standards, and workplace culture to potential offshore clients who cannot visit in person.",
        "FY Intech provides VR facility tours and operational capability demonstrations that build client confidence without requiring physical visits — accelerating client acquisition.",
    ),
    "paper & forest products": (
        "Limited ability to demonstrate sustainable forestry practices and manufacturing processes to environmentally-conscious stakeholders and certification bodies.",
        "FY Intech creates VR sustainability and mill operation walkthroughs that showcase responsible forestry and manufacturing practices — strengthening brand reputation and compliance.",
    ),
    "plastics": (
        "Challenging to demonstrate complex injection molding and extrusion manufacturing processes to B2B clients and new employees.",
        "FY Intech develops VR plastic manufacturing process simulations for client education and workforce training — improving sales conversion and reducing onboarding time.",
    ),
    "publishing": (
        "Limited immersive content delivery channels for digital publications and educational materials in an increasingly visual and interactive media landscape.",
        "FY Intech provides VR publishing platforms that transform traditional content into immersive, interactive reading and learning experiences — opening new revenue streams.",
    ),
    "utilities": (
        "High-risk utility infrastructure training and emergency response drill limitations. Substation, water treatment, and power grid training carries significant safety hazards.",
        "FY Intech builds VR utility infrastructure simulations for power grid, water treatment, and emergency response training — improving safety while maintaining training effectiveness.",
    ),
    "internet": (
        "Need for innovative user experience demonstrations and data center infrastructure visualization for client and investor presentations.",
        "FY Intech creates VR data center walkthroughs and internet infrastructure demonstrations for client and investor presentations — differentiating service offerings in a commodity market.",
    ),
    "international trade & development": (
        "Limited tools for cross-border project visualization and stakeholder alignment across different time zones, languages, and cultural contexts.",
        "FY Intech develops VR project visualization platforms that enable international stakeholders to collaboratively review development projects regardless of physical location — accelerating global partnerships.",
    ),
    "online media": (
        "Need for immersive content formats to differentiate in a crowded digital media landscape where user attention spans continue to decline.",
        "FY Intech provides VR content production services that transform traditional media into immersive 360-degree experiences — capturing audience attention and increasing engagement metrics.",
    ),
    "marketing & advertising": (
        "Traditional advertising media failing to capture audience attention in a saturated market. Consumers increasingly ignore conventional ad formats.",
        "FY Intech creates VR marketing experiences and immersive brand activations that deliver memorable, high-engagement consumer interactions — achieving 5x higher brand recall.",
    ),
    "management consulting": (
        "Limited tools for client workshop facilitation, strategic scenario visualization, and change management communication beyond slide decks and spreadsheets.",
        "FY Intech builds VR strategy visualization environments where consulting firms can run immersive workshops and present complex scenarios to clients — differentiating service delivery.",
    ),
    "consumer services": (
        "Difficulty differentiating service offerings and demonstrating service quality in a competitive market where consumers cannot experience the service before purchase.",
        "FY Intech develops VR service experience previews that allow potential customers to virtually experience service quality before committing — increasing conversion and reducing churn.",
    ),
    "transportation/trucking/railroad": (
        "High training costs and safety risks for drivers and rail operators. Traditional training requires expensive equipment, fuel, and exposes trainees to real-world hazards.",
        "FY Intech creates VR driver training simulations for trucks, rail operators, and logistics vehicles — reducing training costs by 50% and improving safety outcomes through risk-free scenario practice.",
    ),
    "package/freight delivery": (
        "Inefficient warehouse and delivery route training for new logistics staff. High turnover rates make traditional onboarding costly and inconsistent.",
        "FY Intech provides VR logistics training modules for warehouse operations, package handling, and last-mile delivery optimization — accelerating onboarding and reducing operational errors.",
    ),
    "building materials": (
        "Inability to showcase material applications, textures, and finishes in realistic architectural contexts for architects, builders, and property developers.",
        "FY Intech develops VR material showrooms that allow architects and builders to visualize building materials in realistic 3D environments — accelerating specification decisions.",
    ),
    "machinery": (
        "Costly equipment demonstrations and operator training for heavy machinery. Transporting equipment for demos is logistically complex, and training on live machinery poses safety risks.",
        "FY Intech creates VR heavy machinery operation simulations that provide safe, scalable operator training and product demonstrations — reducing demo costs and safety incidents.",
    ),
    "mechanical or industrial engineering": (
        "Complex engineering designs are difficult to review collaboratively with non-technical stakeholders, leading to misunderstandings and late-stage design changes.",
        "FY Intech provides VR engineering design review platforms that enable collaborative 3D model walkthroughs for faster design approval and fewer costly late changes.",
    ),
    "human resources": (
        "Low engagement in employee onboarding, diversity & inclusion training, and soft skills development programs delivered through traditional e-learning formats.",
        "FY Intech develops VR-based employee onboarding and soft skills training modules with immersive role-play scenarios — increasing engagement and behavioral change.",
    ),
    "mental health care": (
        "Limited therapeutic tools for exposure therapy, anxiety management, and creating controlled therapeutic environments for patient treatment.",
        "FY Intech builds VR therapeutic environments for anxiety treatment, phobia exposure therapy, and mindfulness training — expanding treatment options for mental health professionals.",
    ),
    "health": (
        "Generic wellness and health education tools with low user engagement. Traditional health communication fails to motivate behavioral change.",
        "FY Intech develops VR health education and wellness modules that provide immersive anatomy exploration and healthy lifestyle training — improving health literacy and behavior change.",
    ),
    "facilities services": (
        "Difficulty in training staff on complex facility layouts, emergency procedures, and equipment locations across large or multiple sites.",
        "FY Intech provides VR facility familiarization tours and emergency procedure training for facility management staff — accelerating onboarding and improving emergency preparedness.",
    ),
    "leisure": (
        "Need to differentiate leisure experiences and attract digitally-native consumers in a competitive entertainment and recreation market.",
        "FY Intech creates VR-enhanced leisure experiences and virtual attraction previews that drive visitor interest, repeat visits, and social media engagement.",
    ),
    "e-learning": (
        "Low learner engagement and completion rates in traditional online courses. Flat video and text content fails to maintain attention or develop practical skills.",
        "FY Intech provides VR e-learning content development that transforms courses into immersive, interactive learning experiences — achieving 4x higher completion rates.",
    ),
    "research": (
        "Limited tools for collaborative data visualization and complex concept communication among geographically distributed research teams.",
        "FY Intech provides VR research visualization platforms that enable researchers to collaboratively explore complex data sets and molecular models in 3D — accelerating discovery.",
    ),
    "computer & network security": (
        "Limited immersive training for cybersecurity incident response and SOC operations. Tabletop exercises fail to replicate the pressure and complexity of real cyber attacks.",
        "FY Intech creates VR cybersecurity training simulations that place teams in realistic incident response scenarios for hands-on practice — improving response readiness.",
    ),
    "health, wellness & fitness": (
        "Low engagement and retention in health and wellness programs. Traditional fitness and wellness apps fail to provide the immersive motivation needed for sustained behavioral change.",
        "FY Intech develops VR wellness and fitness experiences — including guided meditation environments, immersive workout programs, and therapeutic relaxation spaces — that boost user engagement and program adherence.",
    ),
    "leisure, travel & tourism": (
        "Inability to provide immersive previews of destinations, accommodations, and attractions to potential travelers, limiting booking confidence and conversion.",
        "FY Intech creates VR travel experiences and virtual destination tours that allow travelers to explore hotels, attractions, and destinations before booking — increasing booking confidence and conversion rates.",
    ),
    "rail transportation": (
        "High training costs and safety risks for train operators, maintenance crews, and station staff. Live training on active rail systems is dangerous and disrupts operations.",
        "FY Intech builds VR rail operations training simulations for train driving, track maintenance, and station emergency response — reducing training costs and improving safety compliance.",
    ),
}

# Fallback for any industry not explicitly mapped
DEFAULT = (
    "Traditional methods of training, visualization, and stakeholder engagement are inefficient, costly, and fail to deliver immersive experiences that drive decision-making.",
    "FY Intech Solution Sdn Bhd provides custom VR solutions — including immersive training simulations, 360° virtual tours, and interactive 3D visualizations — tailored to your industry to reduce costs, improve safety, and accelerate business outcomes.",
)


def main():
    db = SessionLocal()
    try:
        leads = db.query(Lead).all()
        updated = 0

        for lead in leads:
            industry = (lead.industry or "").strip().lower()
            problem, solution = INDUSTRY_MAP.get(industry, DEFAULT)

            lead.problem = problem
            lead.solution = solution
            updated += 1

        db.commit()
        print(f"Updated {updated} leads with problem/solution data.")

        # Show industry coverage
        seen = set()
        for lead in leads:
            ind = (lead.industry or "").strip().lower()
            seen.add(ind)

        unmapped = [i for i in seen if i and i not in INDUSTRY_MAP]
        if unmapped:
            print(f"\nUnmapped industries (using default):")
            for u in sorted(unmapped):
                count = sum(1 for l in leads if (l.industry or "").strip().lower() == u)
                print(f"  - {u} ({count} leads)")

    finally:
        db.close()


if __name__ == "__main__":
    main()
