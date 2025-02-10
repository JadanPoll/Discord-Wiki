from bs4 import BeautifulSoup
import re
import cssutils
import markdown
class ConvertLatex:
    def __init__(self):
        # Extended LaTeX-to-HTML mapping for both basic symbols, complex structures, and calculus-related notations
        self.latex_to_html_mapping = {
            '\\langle': '&lt;',   # Left angle bracket
            '\\rangle': '&gt;',   # Right angle bracket
            '\\pm': '&plusmn;',   # Plus-minus symbol
            '\\times': '&times;', # Multiplication sign
            '\\div': '&divide;',  # Division sign
            '\\sqrt': '&radic;',  # Square root
            '\\infty': '&infin;', # Infinity symbol
            '\\leq': '&le;',      # Less than or equal
            '\\geq': '&ge;',      # Greater than or equal
            '\\neq': '&ne;',      # Not equal
            '\\forall': '&forall;',   # For all
            '\\exists': '&exist;',    # There exists
            '\\sum': '&sum;',         # Summation symbol
            '\\prod': '&prod;',       # Product symbol
            '\\int': '&int;',         # Integral symbol
            '\\cup': '&cup;',         # Union symbol
            '\\cap': '&cap;',         # Intersection symbol
            '\\subset': '&sub;',      # Subset symbol
            '\\subseteq': '&sube;',   # Subset or equal symbol
            '\\supset': '&sup;',      # Superset symbol
            '\\supseteq': '&supe;',   # Superset or equal symbol
            '\\partial': '&part;',    # Partial derivative
            '\\lim': 'lim',           # Limit (lim)
            '\\to': '&rarr;',         # Arrow (used in limits, etc.)
            '\\pi': '&pi;',           # Pi
            '\\alpha': '&alpha;',     # Alpha
            '\\beta': '&beta;',       # Beta
            '\\gamma': '&gamma;',     # Gamma
            '\\delta': '&delta;',     # Delta (lowercase)
            '\\Delta': '&Delta;',     # Delta (uppercase)
            '\\epsilon': '&epsilon;', # Epsilon
            '\\mu': '&mu;',           # Mu
            '\\theta': '&theta;',     # Theta
            '\\phi': '&phi;',         # Phi
            '\\log': '<span class="log">log</span>',   # Logarithm
            '\\ln': '<span class="ln">ln</span>',      # Natural log
            '\\sin': '<span class="sin">sin</span>',   # Sine function
            '\\cos': '<span class="cos">cos</span>',   # Cosine function
            '\\tan': '<span class="tan">tan</span>',   # Tangent function



            # Additional symbols for calculus and higher-order derivatives
            '\\dot': '<sup>&#x2D9;</sup>',    # Derivative dot notation
            '\\ddot': '<sup>&#x2DD;</sup>',   # Second derivative double-dot notation
            '\\nabla': '&nabla;',             # Nabla symbol for gradients
            '\\partial_x': '&part;x',         # Partial derivative with respect to x
            '\\partial_y': '&part;y',         # Partial derivative with respect to y
            '\\lim_\\to': '&rarr;',           # Limit symbol with approach
            '\\frac{d}{dx}': '&part;/&part;x',# Derivative notation d/dx

            # Greek letters commonly used in mathematical expressions
            '\\lambda': '&lambda;',           # Lambda
            '\\xi': '&xi;',                   # Xi
            '\\sigma': '&sigma;',             # Sigma
            '\\tau': '&tau;',                 # Tau
            '\\omega': '&omega;',             # Omega
            '\\Omega': '&Omega;',             # Uppercase Omega
            '\\zeta': '&zeta;',               # Zeta
            '\\eta': '&eta;',                 # Eta

            # Brackets, parentheses, and other groupings
            '\\left(': '<span class="left-paren">(</span>',  # Left parenthesis
            '\\right)': '<span class="right-paren">)</span>',# Right parenthesis
            '\\left[': '<span class="left-bracket">[</span>',# Left bracket
            '\\right]': '<span class="right-bracket">]</span>',# Right bracket
            '\\left|': '<span class="left-bar">|</span>',     # Left vertical bar
            '\\right|': '<span class="right-bar">|</span>',   # Right vertical bar
            '\\cdot': '&middot;',                             # Multiplication dot (·)
            '\\ldots': '&hellip;',                            # Ellipsis (...)

            # Special functions and operators
            '\\log_{e}': '<span class="log">ln</span>',       # Logarithm to base e
            '\\log_{10}': '<span class="log">log<sub>10</sub></span>', # Logarithm to base 10
            '\\mod': 'mod',                                   # Modulus operator
            '\\gcd': 'gcd',                                   # Greatest common divisor
            '\\lcm': 'lcm',                                   # Least common multiple
        }

    def replace_latex_symbols(self, text):
        """
        Replaces LaTeX symbols in a string with their HTML equivalents.
        """
         # Ensure closing tags for mathbb and bold
        #text = text.replace(r'\\mathbb{', '<span class="blackboard-bold">').replace('}', '</span>')
        #text = text.replace(r'\\mathbf{', '<strong>').replace('}', '</strong>')

        for latex_symbol, html_tag in self.latex_to_html_mapping.items():
            text = re.sub(re.escape(latex_symbol), html_tag, text)


        return text

    def handle_fractions(self, text):
        """
        Converts LaTeX fractions (\\frac{a}{b}) into HTML.
        """
        fraction_pattern = re.compile(r'\\frac\{([^\{\}]+)\}\{([^\{\}]+)\}')
        while fraction_pattern.search(text):  # Handle nested fractions
            text = fraction_pattern.sub(r'<span class="fraction"><sup>\1</sup>&frasl;<sub>\2</sub></span>', text)
        return text

    def handle_superscripts(self, text):
        """
        Converts LaTeX superscripts (^{...} and ^number) into HTML superscripts.
        """
        superscript_pattern = re.compile(r'\^\{([^\{\}]+)\}')  # Handles ^{...}
        text = superscript_pattern.sub(r'<sup>\1</sup>', text)

        superscript_number_pattern = re.compile(r'\^([0-9]+)')  # Handles ^number
        text = superscript_number_pattern.sub(r'<sup>\1</sup>', text)

        return text

    def handle_subscripts(self, text):
        """
        Converts LaTeX subscripts (_{...}) into HTML subscripts.
        """
        subscript_pattern = re.compile(r'_\{([^\{\}]+)\}')
        return subscript_pattern.sub(r'<sub>\1</sub>', text)

    def parse_latex_expressions(self, text):
        """
        Handles complex LaTeX expressions, including fractions, superscripts, and subscripts.
        """
        text = self.handle_fractions(text)
        text = self.handle_superscripts(text)
        text = self.handle_subscripts(text)
        return text

    def convert_latex_to_html(self, html_content):
        """
        Converts LaTeX-like math expressions in HTML content to equivalent HTML entities.
        """
        # Parse the HTML content
        soup = BeautifulSoup(html_content, 'html.parser')
        # Define patterns for capturing relevant LaTeX expressions
        bold_pattern = re.compile(r'\\mathbf\{(\w+)\}')
        blackboard_pattern = re.compile(r'\\mathbb\{(\w+)\}')
        superscript_pattern = re.compile(r'\^(\{?\w+\}?)')  # ^ followed by either {expression} or a single character
        subscript_pattern = re.compile(r'_(\{?\w+\}?)')     # _ followed by either {expression} or a single character

        for element in soup.find_all(text=True):
            text = element

            if re.search(r'\\[a-zA-Z]+', text):
                text = self.replace_latex_symbols(text)
            
            text = self.handle_fractions(text)
            # Replace bold LaTeX expressions (\mathbf{...}) with <strong>
            text = bold_pattern.sub(r' <strong>&nbsp; \1 &nbsp;</strong> ', text)

            # Replace blackboard bold LaTeX expressions (\mathbb{...}) with <span class="blackboard-bold">
            text = blackboard_pattern.sub(r' <span class="blackboard-bold">&nbsp; \1 &nbsp;</span>' , text)

            # Replace superscript expressions (^x or ^{x}) with <sup>
            text = superscript_pattern.sub(r' <sup>&nbsp; \1 &nbsp;</sup> ', text)

            # Replace subscript expressions (_x or _{x}) with <sub>
            text = subscript_pattern.sub(r' <sub>&nbsp; \1 &nbsp;</sub> ', text)


            new_element = BeautifulSoup(text, 'html.parser')
            element.replace_with(new_element)


        return soup



class HTMLGenerator:


    def __init__(self):


        # Define theme colors with better values to fit the descriptions
        self.themes = {
            "default": ("#FF4C4C", "#4CFF4C", "#4C4CFF", "#C64CFF"),  # Bright primary colors
            "light": ("#FFFFFF", "#E0E0E0", "#CCCCCC", "#B0B0B0"),  # Light and neutral shades
            "dark": ("#1A1A1A", "#2B2B2B", "#3D3D3D", "#4F4F4F"),  # Dark and muted tones
            "monochrome": ("#000000", "#555555", "#AAAAAA", "#FFFFFF"),  # Black, white, and grays
            "nature": ("#4B8F29", "#8FBF5A", "#C6E48B", "#556B2F"),  # Earthy greens and browns
            "ocean": ("#004080", "#0077B6", "#0096C7", "#00B4D8"),  # Deep and vibrant blues
            "sunset": ("#FF4500", "#FF7F50", "#FF8C00", "#FFD700"),  # Warm reds, oranges, and yellows
            "forest": ("#013220", "#3A5F0B", "#7B8C4C", "#A9C99E"),  # Dark greens and browns
            "autumn": ("#A52A2A", "#FF6347", "#FF8C00", "#D2691E"),  # Autumnal browns, oranges, and reds
            "pastel": ("#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9"),  # Soft and muted colors
            "space": ("#0B0D17", "#3D3D5C", "#6B6B8B", "#A7A7C5"),  # Deep blues and purples, space-like
            "desert": ("#C19A6B", "#D2B48C", "#EDC9AF", "#F4A460"),  # Sandy and earthy tones
            "spring": ("#77DD77", "#FFB347", "#FDFD96", "#84B6F4"),  # Bright greens, yellows, and blues
            "rainbow": ("#FF0000", "#FF7F00", "#FFFF00", "#00FF00"),  # Traditional rainbow spectrum
            "vintage": ("#7E4A35", "#B48C65", "#D1B384", "#C0C0C0"),  # Faded browns and muted pastels
            "winter": ("#4682B4", "#ADD8E6", "#FFFFFF", "#D3D3D3"),  # Cool blues, whites, and grays
        }

        # Define sub-section colors for each theme with better values
        self.sub_section_colors = {
            "default": ["#EFEFEF", "#DFDFDF"],  # Light grays
            "light": ["#F8F9FA", "#E9ECEF"],  # Very light grays
            "dark": ["#333333", "#444444"],  # Dark grays
            "monochrome": ["#D0D0D0", "#F0F0F0"],  # Light grays
            "nature": ["#E6F2E6", "#CCFFCC"],  # Light greens
            "ocean": ["#E0FFFF", "#AFEEEE"],  # Light blues
            "sunset": ["#FFB347", "#FFA07A"],  # Warm pastel colors
            "forest": ["#E1EAD6", "#A8D5BA"],  # Soft greens
            "autumn": ["#FFEFD5", "#FFDAB9"],  # Pale oranges and yellows
            "pastel": ["#FFE4E1", "#FFF0F5"],  # Light pastels
            "space": ["#282C34", "#3A3F54"],  # Very dark blue shades
            "desert": ["#FFE4C4", "#F4A460"],  # Sandy tones
            "spring": ["#E6E6FA", "#FFFACD"],  # Soft yellows and lavenders
            "rainbow": ["#FFFAFA", "#F0FFF0"],  # Soft and off-whites
            "vintage": ["#FAEBD7", "#EEDFCC"],  # Faded antique whites
            "winter": ["#F0F8FF", "#E6E6FA"],  # Cold whites and blues
        }
        self.convertLatex=ConvertLatex()



    def inline_css(self, html_content):
        soup = BeautifulSoup(html_content, 'html.parser')
        style_tag = soup.find('style')

        if style_tag:
            try:
                css_styles = cssutils.parseString(style_tag.string)
            except cssutils.CSSParseException as e:
                    print(f"Error parsing CSS: {e}")
                    return html_content

            style_tag.decompose()

            for rule in css_styles:
                if rule.type == rule.STYLE_RULE:
                    css_text = rule.style.getCssText()
                    for selector in rule.selectorList:
                        elements = soup.select(selector.selectorText)
                        for element in elements:
                            existing_styles = element.get('style', '')
                            if existing_styles:
                                element['style'] = f"{existing_styles}; {css_text}"
                            else:
                                element['style'] = css_text

        return str(soup)








    def generate_html_response(self, prompt, response_title, colors, section_colors, html_content, theme="default", use_backgrounding=True):
        color1, color2, color3, color4 = colors

        soup = BeautifulSoup(html_content, 'html.parser')

        # Expanded mapping of tag names to corresponding HTML tags and styles
        tag_mapping = {
            'h1': ('h2', color1),  # h1 is converted to h2 with color1
            'h2': ('h3', color2),  # h2 is converted to h3 with color2
            'h3': ('h4', color2),  # h3 is converted to h4 with color2
            'h4': ('h5', color3),  # h4 is converted to h5 with color3
            'h5': ('h6', color3),  # h5 is converted to h6 with color3
            'h6': ('h6', color4),  # h6 remains as h6 but with color4
            'p': ('p', None),
            'ol': ('ol', None),
            'ul': ('ul', None),
            'li': ('li', None),
            'strong': ('h3', color3),
            'blockquote': ('blockquote', None),  # Example: Keep blockquote with no change
            'code': ('i', None),  # Convert inline code to preformatted block
            'em': ('em', None),  # Emphasized text stays the same
            'table': ('table', None),  # Table stays the same but styled differently
            'tr': ('tr', None),
            'th': ('th', None),
            'td': ('td', None),
        }

        # Modifying the existing content in soup
        for section_index, section in enumerate(soup.find_all(tag_mapping.keys())):
            tag, color = tag_mapping[section.name]
            section_color = section_colors[section_index % len(section_colors)]

            # Clear existing content and set new formatted HTML
            if section.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag} style="color: {color};">{section.decode_contents()}</{tag}></div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name == 'p':
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag}>{section.decode_contents()}</{tag}>\n</div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name in ['ol', 'ul']:
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag}>{section.decode_contents()}</{tag}>\n</div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name == 'li':
                new_html = f'<{tag}>{section.decode_contents()}</{tag}>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name == 'strong':
                new_html = f'<{tag} style="color: {color};">{section.decode_contents()}</{tag}>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name == 'blockquote':
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag}>{section.decode_contents()}</{tag}>\n</div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name == 'code':
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag}>{section.decode_contents()}</{tag}>\n</div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))
            elif section.name in ['table', 'tr', 'th', 'td']:
                # Leave tables as is but wrap in a styled section
                new_html = f'<div class="sub-section" style="background-color: {section_color};">\n<{tag}>{section.decode_contents()}</{tag}>\n</div>'
                section.replace_with(BeautifulSoup(new_html, 'html.parser'))

        # Generate final HTML template
        body_bg_color = "#f8f8f8" if use_backgrounding else "transparent"
        html_template = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <title>{response_title}</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    background-color: {body_bg_color};
                    margin: 0;
                    padding: 10px;
                }}
                h1 {{ color: {color1}; font-size: 25px; margin-bottom: 8px; }}
                h2 {{ color: {color2}; font-size: 23px; margin-bottom: 6px; }}
                h3 {{ color: {color3}; font-size: 21px; margin-bottom: 4px; }}
                h4 {{ color: {color4}; font-size: 19px; margin-bottom: 4px; }}
                h5 {{ color: {color3}; font-size: 17px; margin-bottom: 3px; }}
                h6 {{ color: {color4}; font-size: 15px; margin-bottom: 2px; }}
                p {{ line-height: 1.4; margin-bottom: 8px; }}
                section {{
                    background-color: #ffffff;
                    border-radius: 5px;
                    margin-bottom: 10px;
                    padding: 15px;
                }}
                .sub-section {{
                    border-radius: 5px;
                    padding: 10px;
                    margin-bottom: 8px;
                }}
            </style>

            <style>
            .hoverable2 {{
                padding: 3px;
                border-radius: 12px;
                cursor: pointer;
            }}

            .hoverable2:hover {{
                background-color: #c4b3ff; /* Slightly darker purple for hover effect */
                border-color: #a085ff; /* Accent color for hover border */
            }}

            /* Hover effect with rounded corners and tooltip */
            .hoverable {{
                padding: 3px;
                border-radius: 12px;
                cursor: pointer;
            }}

            .hoverable:hover {{
                background-color: #ffa500;
            }}

            </style>
        <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

        </head>
        <body>
            <section>
                <p>{prompt}</p>
                <div class="sub-section"></div>
            </section>
            <section>
                {str(soup)}
            </section>
        </body>
        </html>'''
        html_template = html_template

        return self.inline_css(html_template)






    def respond_with_html(self, prompt, contents, theme="default", use_backgrounding=True):

        response_title = "Response Title"
        if theme not in self.themes:
            theme = "default"

        theme_colors = self.themes[theme]
        section_colors = self.sub_section_colors[theme]

        html_response = self.generate_html_response(prompt, response_title, theme_colors, section_colors, contents)
        return html_response



    def markdown_to_html(self,markdown_content):
        """Convert Markdown to HTML."""
        return markdown.markdown(markdown_content)

    def generate_and_display_html(self, prompt, contents, theme="default", use_backgrounding=True,markdown=False):
        if markdown:

            contents = self.markdown_to_html(contents)
        html_response = self.respond_with_html(prompt, contents, theme, use_backgrounding)
        #self.display_html(html_response)

        return html_response
